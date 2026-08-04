"""Core credit engine tests — isolated Motor client (no TestClient event-loop coupling)."""

import asyncio
import os
import uuid

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "memoryhub_test")

# Seed catalog using a dedicated connection before service imports use server.db.
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

# Index specs are ensured by server startup / db_indexes.ensure_index at runtime.
# Tests must not recreate conflicting legacy indexes on the shared dev database.

from ai_usage_service import consume_for_import  # noqa: E402
from billing_service import activate_subscription, grant_bonus_credits, record_credit_purchase  # noqa: E402
from credit_cost_service import resolve_cost, seed_default_costs  # noqa: E402
from credit_exceptions import InsufficientCreditsError  # noqa: E402
from credit_service import (  # noqa: E402
    consume,
    get_balance,
    grant_monthly_credits,
    grant_permanent_credits,
    rollover_period_if_needed,
    rollback_debit,
)
from credit_transaction_service import list_transactions  # noqa: E402


def _user_id() -> str:
    return str(uuid.uuid4())


def test_monthly_grant_and_balance():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 500
    assert balance.permanentRemaining == 0
    assert balance.planId == "solo"


def test_permanent_grant():
    user_id = _user_id()
    _run(grant_permanent_credits(_db, user_id, 250, source="purchase"))
    balance = _run(get_balance(_db, user_id))
    assert balance.permanentRemaining == 250


def test_consume_monthly_before_permanent():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    _run(grant_permanent_credits(_db, user_id, 100))

    result = _run(consume(_db, user_id, "SUMMARY", cost=15))
    assert result.monthlyDebited == 15
    assert result.permanentDebited == 0

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 985
    assert balance.permanentRemaining == 100


def test_consume_spills_to_permanent():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    _run(grant_permanent_credits(_db, user_id, 50))
    _run(
        _db.user_credit_accounts.update_one(
            {"userId": user_id},
            {"$set": {"monthlyCreditsRemaining": 5}},
        )
    )

    result = _run(consume(_db, user_id, "IMPORT_DOCUMENT", cost=12))
    assert result.monthlyDebited == 5
    assert result.permanentDebited == 7

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 0
    assert balance.permanentRemaining == 43


def test_insufficient_credits_raises():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    _run(
        _db.user_credit_accounts.update_one(
            {"userId": user_id},
            {"$set": {"monthlyCreditsRemaining": 2, "permanentCreditsRemaining": 0}},
        )
    )
    with pytest.raises(InsufficientCreditsError):
        _run(consume(_db, user_id, "IMPORT_DOCUMENT", cost=12))


def test_idempotency_prevents_double_debit():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    key = f"test:{uuid.uuid4().hex}"

    first = _run(consume(_db, user_id, "SUMMARY", cost=5, idempotency_key=key))
    second = _run(consume(_db, user_id, "SUMMARY", cost=5, idempotency_key=key))
    assert second.idempotentReplay is True
    assert second.transactionId == first.transactionId

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 495


def test_rollback_restores_buckets():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    _run(grant_permanent_credits(_db, user_id, 50))
    _run(
        _db.user_credit_accounts.update_one(
            {"userId": user_id},
            {"$set": {"monthlyCreditsRemaining": 3}},
        )
    )

    result = _run(consume(_db, user_id, "CLIENT_ANALYSIS", cost=10))
    _run(rollback_debit(_db, user_id, result.transactionId))

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 3
    assert balance.permanentRemaining == 50


def test_monthly_expiry_on_period_rollover():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    _run(
        _db.user_credit_accounts.update_one(
            {"userId": user_id},
            {"$set": {"periodKey": "2020-01", "monthlyCreditsRemaining": 42}},
        )
    )
    account = _run(_db.user_credit_accounts.find_one({"userId": user_id}))
    _run(rollover_period_if_needed(_db, user_id, account))

    balance = _run(get_balance(_db, user_id))
    assert balance.monthlyRemaining == 500

    items, _total = _run(list_transactions(_db, user_id, limit=20))
    types = [item.type for item in items]
    assert "monthly_expiry" in types


def test_transaction_history_recorded():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    _run(consume(_db, user_id, "EMAIL_GENERATION"))

    items, total = _run(list_transactions(_db, user_id, limit=10))
    assert total >= 2
    debits = [item for item in items if item.type == "debit"]
    assert debits[0].actionKey == "EMAIL_GENERATION"


def test_tier_cost_resolution():
    _run(seed_default_costs(_db))
    simple = _run(resolve_cost(_db, "IMPORT_DOCUMENT", tier_key="simple"))
    complex_ = _run(resolve_cost(_db, "IMPORT_DOCUMENT", tier_key="complex"))
    assert simple == 8
    assert complex_ == 20


def test_billing_service_activate_subscription():
    user_id = _user_id()
    balance = _run(activate_subscription(_db, user_id, "pro"))
    assert balance.monthlyRemaining == 1000


def test_billing_service_purchase_and_bonus():
    user_id = _user_id()
    _run(record_credit_purchase(_db, user_id, 300, payment_reference="pay_test"))
    _run(grant_bonus_credits(_db, user_id, 50, campaign="launch"))
    balance = _run(get_balance(_db, user_id))
    assert balance.permanentRemaining == 350


def test_concurrent_consume_atomicity():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    _run(
        _db.user_credit_accounts.update_one(
            {"userId": user_id},
            {"$set": {"monthlyCreditsRemaining": 10, "permanentCreditsRemaining": 0}},
        )
    )

    async def _run_concurrent():
        async def _debit(i):
            return await consume(
                _db,
                user_id,
                "SEARCH_AI",
                cost=3,
                idempotency_key=f"concurrent:{uuid.uuid4().hex}:{i}",
            )

        return await asyncio.gather(*[_debit(i) for i in range(5)], return_exceptions=True)

    results = _run(_run_concurrent())
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, Exception)]

    assert len(successes) == 3
    assert len(failures) == 2

    balance = _run(get_balance(_db, user_id))
    assert balance.totalRemaining == 1


def test_import_usage_with_idempotency():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    session_id = str(uuid.uuid4())

    first = _run(consume_for_import(_db, user_id, session_id=session_id))
    second = _run(consume_for_import(_db, user_id, session_id=session_id))
    assert second.idempotentReplay is True
    assert first.transactionId == second.transactionId
