"""Billing API — checkout, portal, plan changes, billing overview."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Request

from auth import get_current_user, get_db
from credit_service import get_balance
from credit_exceptions import CreditPlanNotFoundError, CreditPackNotFoundError, DevCreditPurchaseNotAllowedError
from credit_purchase_service import (
    create_pending_stripe_purchase,
    get_purchase_capabilities,
    list_user_credit_purchases,
    simulate_dev_credit_purchase,
    credit_pack_checkout_available,
)
from analysis_presentation_service import (
    balance_to_analyses_public,
    pack_to_analyses_public,
    purchase_to_analyses_public,
    credits_to_analyses,
)
from credit_models import (
    CreditPackCheckoutRequest,
    AnalysisPackListResponse,
    AnalysisPurchaseListResponse,
    DevCreditPurchaseRequest,
    DevCreditPurchaseResponse,
)
from plan_service import get_plan, list_active_plans
from rate_limit import rate_limit
from stripe_config import get_stripe_settings, stripe_configured
from stripe_exceptions import (
    StripeCheckoutError,
    StripeIntegrationError,
    StripeNotConfiguredError,
    StripeSubscriptionConflictError,
)
from stripe_models import (
    BillingActions,
    BillingMeResponse,
    ChangePlanRequest,
    ChangePlanResponse,
    CheckoutRequest,
    CheckoutResponse,
    PortalResponse,
)
from stripe_service import (
    create_customer_portal,
    create_credit_pack_checkout,
    create_subscription_checkout,
    change_stripe_subscription_plan,
)
from stripe_webhook_service import process_stripe_webhook
from subscription_constants import PLAN_TIER_ORDER
from subscription_exceptions import SubscriptionAlreadyExistsError, SubscriptionNotFoundError
from subscription_service import (
    ACTIVE_LIKE_STATUSES,
    get_subscription_doc,
    sync_lifecycle,
    user_has_trial_history,
)

logger = logging.getLogger(__name__)

billing_router = APIRouter(prefix="/billing", tags=["billing"])
stripe_router = APIRouter(prefix="/stripe", tags=["stripe"])

checkout_rate_limit = rate_limit(max_requests=10, window_seconds=300)
portal_rate_limit = rate_limit(max_requests=10, window_seconds=300)
change_plan_rate_limit = rate_limit(max_requests=10, window_seconds=300)
credit_purchase_rate_limit = rate_limit(max_requests=20, window_seconds=300)


def _stripe_http_error(exc: StripeIntegrationError) -> HTTPException:
    status = 503 if exc.code == "stripe_not_configured" else 400
    if exc.code == "subscription_conflict":
        status = 409
    return HTTPException(status_code=status, detail={"message": exc.message, "code": exc.code})


def _build_actions(
    *,
    stripe_ok: bool,
    sub_doc: Optional[dict],
) -> BillingActions:
    if not stripe_ok:
        return BillingActions()

    # Local app trials (no Stripe subscription id) must still be able to open Checkout.
    has_stripe_sub = bool(sub_doc and sub_doc.get("stripeSubscriptionId"))
    stripe_active = has_stripe_sub and sub_doc.get("status") in ACTIVE_LIKE_STATUSES
    return BillingActions(
        canCheckout=not stripe_active,
        canManage=has_stripe_sub,
        canUpgrade=stripe_active,
        canDowngrade=stripe_active,
        canCancel=stripe_active,
        canChangePlan=stripe_active,
    )


@billing_router.get("/me", response_model=BillingMeResponse)
async def billing_me(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    settings = get_stripe_settings()
    stripe_ok = stripe_configured() and settings is not None

    sub_doc = await get_subscription_doc(db, current_user["id"])
    if sub_doc:
        sub_doc = await sync_lifecycle(db, current_user["id"], sub_doc)

    balance = await get_balance(db, current_user["id"])
    plans = await list_active_plans(db)
    caps = await get_purchase_capabilities(db)

    plan_name = None
    if sub_doc and sub_doc.get("planId"):
        try:
            plan_name = (await get_plan(db, sub_doc["planId"])).name
        except Exception:
            plan_name = sub_doc["planId"]

    return BillingMeResponse(
        hasSubscription=bool(sub_doc),
        planId=sub_doc.get("planId") if sub_doc else None,
        planName=plan_name,
        subscriptionStatus=sub_doc.get("status") if sub_doc else None,
        trialEndsAt=sub_doc.get("trialEndsAt") if sub_doc else None,
        currentPeriodEnd=sub_doc.get("currentPeriodEnd") if sub_doc else None,
        cancelAtPeriodEnd=bool(sub_doc.get("cancelAtPeriodEnd")) if sub_doc else False,
        monthlyAnalysesRemaining=credits_to_analyses(balance.monthlyRemaining),
        monthlyAnalysesAllocated=credits_to_analyses(balance.monthlyAllocated),
        permanentAnalysesRemaining=credits_to_analyses(balance.permanentRemaining),
        totalAnalysesRemaining=credits_to_analyses(balance.totalRemaining),
        stripeConfigured=stripe_ok,
        stripeTestMode=settings.is_test_mode if settings else False,
        devCreditPurchasesEnabled=caps["devCreditPurchasesEnabled"],
        stripeCreditCheckoutEnabled=caps["stripeCreditCheckoutEnabled"],
        availablePlans=[p.id for p in plans],
        actions=_build_actions(stripe_ok=stripe_ok, sub_doc=sub_doc),
    )


@billing_router.get("/credit-packs", response_model=AnalysisPackListResponse)
async def list_credit_packs(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    caps = await get_purchase_capabilities(db)
    return AnalysisPackListResponse(
        packs=[pack_to_analyses_public(p) for p in caps["packs"]],
        devCreditPurchasesEnabled=caps["devCreditPurchasesEnabled"],
        stripeCreditCheckoutEnabled=caps["stripeCreditCheckoutEnabled"],
    )


@billing_router.get("/credit-purchases", response_model=AnalysisPurchaseListResponse)
async def list_credit_purchases(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    items, total = await list_user_credit_purchases(db, current_user["id"], limit=limit)
    return AnalysisPurchaseListResponse(
        items=[purchase_to_analyses_public(item) for item in items],
        total=total,
    )


@billing_router.post("/credit-packs/dev-purchase", response_model=DevCreditPurchaseResponse)
async def dev_purchase_credit_pack(
    body: DevCreditPurchaseRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(credit_purchase_rate_limit),
):
    try:
        idempotency_key = request.headers.get("Idempotency-Key")
        result = await simulate_dev_credit_purchase(
            db,
            current_user["id"],
            body.packKey,
            idempotency_key=idempotency_key,
        )
        return DevCreditPurchaseResponse(
            purchase=purchase_to_analyses_public(result["purchase"]),
            balance=balance_to_analyses_public(result["balance"]),
            transactionId=result.get("transactionId"),
            idempotentReplay=result.get("idempotentReplay", False),
        )
    except DevCreditPurchaseNotAllowedError as exc:
        raise HTTPException(status_code=403, detail={"message": exc.message, "code": exc.code}) from exc
    except CreditPackNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc), "code": exc.code}) from exc


@billing_router.post("/credit-packs/checkout", response_model=CheckoutResponse)
async def checkout_credit_pack(
    body: CreditPackCheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(credit_purchase_rate_limit),
):
    import uuid

    try:
        if not credit_pack_checkout_available():
            raise StripeNotConfiguredError()

        from credit_pack_service import get_pack_doc, pack_stripe_price_id

        pack_doc = await get_pack_doc(db, body.packKey)
        if not pack_stripe_price_id(pack_doc):
            raise StripeCheckoutError("Stripe price is not configured for this credit pack.")

        purchase_id = str(uuid.uuid4())
        result = await create_credit_pack_checkout(
            db,
            current_user,
            body.packKey,
            purchase_id=purchase_id,
        )
        await create_pending_stripe_purchase(
            db,
            current_user["id"],
            body.packKey,
            purchase_id=purchase_id,
            stripe_checkout_session_id=result.session_id,
        )
        return CheckoutResponse(checkoutUrl=result.url)
    except CreditPackNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc), "code": exc.code}) from exc
    except StripeIntegrationError as exc:
        raise _stripe_http_error(exc) from exc


@billing_router.post("/checkout", response_model=CheckoutResponse)
async def start_checkout(
    body: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(checkout_rate_limit),
):
    try:
        await get_plan(db, body.planId)
        sub_doc = await get_subscription_doc(db, current_user["id"])
        # Block only Stripe-backed active-like subscriptions. Local trials can convert via Checkout.
        if (
            sub_doc
            and sub_doc.get("stripeSubscriptionId")
            and sub_doc.get("status") in ACTIVE_LIKE_STATUSES
        ):
            raise StripeSubscriptionConflictError()

        include_trial = not await user_has_trial_history(db, current_user["id"])
        result = await create_subscription_checkout(
            db,
            current_user,
            body.planId,
            include_trial=include_trial,
        )
        return CheckoutResponse(checkoutUrl=result.url)
    except CreditPlanNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc), "code": exc.code}) from exc
    except StripeIntegrationError as exc:
        raise _stripe_http_error(exc) from exc
    except SubscriptionAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail={"message": str(exc), "code": exc.code}) from exc


@billing_router.post("/portal", response_model=PortalResponse)
async def open_portal(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(portal_rate_limit),
):
    try:
        sub_doc = await get_subscription_doc(db, current_user["id"])
        if not sub_doc:
            raise StripeCheckoutError("No subscription linked to this account.")
        result = await create_customer_portal(db, current_user)
        return PortalResponse(portalUrl=result.url)
    except StripeIntegrationError as exc:
        raise _stripe_http_error(exc) from exc


@billing_router.post("/change-plan", response_model=ChangePlanResponse)
async def change_plan_endpoint(
    body: ChangePlanRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    _rate=Depends(change_plan_rate_limit),
):
    try:
        await get_plan(db, body.planId)
        sub_doc = await get_subscription_doc(db, current_user["id"])
        if not sub_doc:
            raise SubscriptionNotFoundError(current_user["id"])

        old_tier = PLAN_TIER_ORDER.get(sub_doc.get("planId", ""), 0)
        new_tier = PLAN_TIER_ORDER.get(body.planId, 0)
        if new_tier == old_tier:
            return ChangePlanResponse(
                message="Already on this plan.",
                effective="none",
                planId=body.planId,
            )

        is_upgrade = new_tier > old_tier
        effective = await change_stripe_subscription_plan(
            db,
            current_user["id"],
            sub_doc,
            body.planId,
            is_upgrade=is_upgrade,
        )
        return ChangePlanResponse(
            message="Plan change submitted to Stripe. Your account will update after confirmation.",
            effective=effective,
            planId=body.planId,
        )
    except StripeIntegrationError as exc:
        raise _stripe_http_error(exc) from exc
    except SubscriptionNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc), "code": exc.code}) from exc


@stripe_router.post("/webhook")
async def stripe_webhook(request: Request, db=Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    try:
        result = await process_stripe_webhook(db, payload, sig_header)
        return result
    except StripeNotConfiguredError as exc:
        raise _stripe_http_error(exc) from exc
    except StripeIntegrationError as exc:
        if exc.code == "stripe_webhook_error":
            raise HTTPException(status_code=400, detail={"message": exc.message, "code": exc.code}) from exc
        logger.exception("Stripe webhook error")
        raise HTTPException(status_code=500, detail={"message": "Webhook processing failed."}) from exc
