"""Core subscription engine tests — isolated Motor client."""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "memoryhub_test")

_mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _mongo[os.environ["DB_NAME"]]
_loop = asyncio.new_event_loop()


@pytest.fixture(autouse=True)
def _credits_enforced(monkeypatch):
    monkeypatch.setenv("CREDITS_ENFORCED", "true")


def _run(coro):
    return _loop.run_until_complete(coro)


from credit_seed import seed_credit_catalog  # noqa: E402

_run(seed_credit_catalog(_db))

from billing_service import (  # noqa: E402
    activate_subscription as billing_activate,
    handle_payment_failed,
    handle_plan_changed,
    handle_subscription_cancelled,
    handle_subscription_renewed,
)
from credit_service import get_balance  # noqa: E402
from subscription_exceptions import (  # noqa: E402
    InvalidPlanChangeError,
    InvalidSubscriptionTransitionError,
    SubscriptionAlreadyExistsError,
    SubscriptionNotFoundError,
)
from subscription_history_service import list_history  # noqa: E402
from subscription_service import (  # noqa: E402
    activate_paid_subscription,
    activate_subscription,
    cancel_subscription,
    create_subscription,
    downgrade_subscription,
    expire_subscription,
    get_subscription,
    mark_past_due,
    reactivate_subscription,
    renew_subscription,
    resume_subscription,
    suspend_subscription,
    sync_lifecycle,
    upgrade_subscription,
)


def _user_id() -> str:
    return str(uuid.uuid4())


async def _cleanup_user(user_id: str):
    await _db.user_subscriptions.delete_many({"userId": user_id})
    await _db.subscription_history.delete_many({"userId": user_id})
    await _db.user_credit_accounts.delete_many({"userId": user_id})
    await _db.credit_transactions.delete_many({"userId": user_id})


def test_create_trial_subscription():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    sub = _run(create_subscription(_db, user_id, "solo", start_with_trial=True))
    assert sub.status == "trial"
    assert sub.planId == "solo"
    assert sub.trialEndsAt is not None

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 1000
    assert balance.planId == "solo"


def test_create_active_subscription_without_trial():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    sub = _run(create_subscription(_db, user_id, "pro", start_with_trial=False))
    assert sub.status == "active"
    assert sub.activatedAt is not None

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 4000


def test_activate_trial_to_active():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=True))
    sub = _run(activate_subscription(_db, user_id))
    assert sub.status == "active"
    assert sub.trialEndsAt is None

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 1000


def test_renew_subscription_grants_new_period():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    before = _run(get_subscription(_db, user_id))
    sub = _run(renew_subscription(_db, user_id))
    assert sub.periodKey != before.periodKey
    assert sub.status == "active"

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 1000

    items, _ = _run(list_history(_db, user_id))
    events = [item.event for item in items]
    assert "renewed" in events


def test_renew_idempotency():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    key = f"invoice:{uuid.uuid4().hex}"
    first = _run(renew_subscription(_db, user_id, idempotency_key=key))
    second = _run(renew_subscription(_db, user_id, idempotency_key=key))
    assert first.periodKey == second.periodKey


def test_upgrade_plan():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    sub = _run(upgrade_subscription(_db, user_id, "pro"))
    assert sub.planId == "pro"

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 4000

    items, _ = _run(list_history(_db, user_id))
    assert any(item.event == "upgraded" for item in items)


def test_downgrade_plan():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "team", start_with_trial=False))
    sub = _run(downgrade_subscription(_db, user_id, "solo"))
    assert sub.planId == "solo"

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 1000


def test_downgrade_invalid_raises():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    with pytest.raises(InvalidPlanChangeError):
        _run(downgrade_subscription(_db, user_id, "pro"))


def test_cancel_at_period_end():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    sub = _run(cancel_subscription(_db, user_id, at_period_end=True))
    assert sub.cancelAtPeriodEnd is True
    assert sub.status == "active"


def test_cancel_immediate():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=True))
    sub = _run(cancel_subscription(_db, user_id, at_period_end=False))
    assert sub.status == "cancelled"
    assert sub.cancelledAt is not None


def test_trial_expires_lazily():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=True))
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    _run(
        _db.user_subscriptions.update_one(
            {"userId": user_id},
            {"$set": {"trialEndsAt": past}},
        )
    )
    doc = _run(_db.user_subscriptions.find_one({"userId": user_id}))
    doc = _run(sync_lifecycle(_db, user_id, doc))
    assert doc["status"] == "expired"


def test_expire_subscription():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    sub = _run(expire_subscription(_db, user_id))
    assert sub.status == "expired"


def test_past_due_status():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    sub = _run(mark_past_due(_db, user_id))
    assert sub.status == "past_due"
    assert sub.pastDueAt is not None

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 1000


def test_suspend_and_resume():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "pro", start_with_trial=False))
    suspended = _run(suspend_subscription(_db, user_id, reason="abuse"))
    assert suspended.status == "suspended"

    balance = _run(get_balance(_db, user_id))
    assert balance.planId is None

    resumed = _run(resume_subscription(_db, user_id))
    assert resumed.status == "active"
    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 4000


def test_reactivate_expired():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    _run(expire_subscription(_db, user_id))
    sub = _run(reactivate_subscription(_db, user_id, plan_id="pro"))
    assert sub.status == "active"
    assert sub.planId == "pro"

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 4000


def test_duplicate_active_subscription_raises():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=True))
    with pytest.raises(SubscriptionAlreadyExistsError):
        _run(create_subscription(_db, user_id, "pro", start_with_trial=True))


def test_subscription_not_found():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    with pytest.raises(SubscriptionNotFoundError):
        _run(get_subscription(_db, user_id))


def test_invalid_transition_activate_non_trial():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    with pytest.raises(InvalidSubscriptionTransitionError):
        _run(activate_subscription(_db, user_id))


def test_history_recorded_on_lifecycle():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=True))
    _run(activate_subscription(_db, user_id))
    _run(upgrade_subscription(_db, user_id, "team"))

    items, total = _run(list_history(_db, user_id))
    assert total >= 3
    events = {item.event for item in items}
    assert "trial_started" in events
    assert "activated" in events
    assert "upgraded" in events


def test_billing_service_activate_delegates():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    balance = _run(billing_activate(_db, user_id, "solo"))
    assert balance.monthlyRemaining == 1000
    sub = _run(get_subscription(_db, user_id))
    assert sub.status == "active"
    assert sub.planId == "solo"


def test_billing_service_webhook_handlers():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(billing_activate(_db, user_id, "solo"))
    _run(handle_payment_failed(_db, user_id, invoice_reference="inv_1"))
    sub = _run(get_subscription(_db, user_id))
    assert sub.status == "past_due"

    renewed = _run(handle_subscription_renewed(_db, user_id, invoice_reference="inv_2"))
    assert renewed.status == "active"

    changed = _run(handle_plan_changed(_db, user_id, "pro", payment_reference="sub_upd"))
    assert changed.planId == "pro"

    cancelled = _run(handle_subscription_cancelled(_db, user_id, at_period_end=True))
    assert cancelled.cancelAtPeriodEnd is True


def test_activate_paid_after_cancelled():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    _run(cancel_subscription(_db, user_id, at_period_end=False))
    sub = _run(activate_paid_subscription(_db, user_id, "pro", start_with_trial=False))
    assert sub.status == "active"
    assert sub.planId == "pro"


def test_consume_uses_subscription_credits():
    user_id = _user_id()
    _run(_cleanup_user(user_id))

    from credit_service import consume  # noqa: E402

    _run(create_subscription(_db, user_id, "solo", start_with_trial=False))
    result = _run(consume(_db, user_id, "SUMMARY", cost=5))
    assert result.monthlyDebited == 5

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 995
