"""Internal admin API — founder operations dashboard."""

from __future__ import annotations

import csv
import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from admin_actions_service import (
    admin_grant_credits,
    admin_resend_verification,
    admin_resume_account,
    admin_suspend_account,
)
from admin_audit_service import log_admin_action
from admin_auth import client_ip, require_admin, request_id
from admin_constants import ADMIN_EXPORT_MAX_ROWS, ADMIN_PAGE_SIZE_DEFAULT
from admin_metrics_service import (
    build_alerts,
    build_overview,
    check_system_health,
    get_admin_user_detail,
    list_admin_users,
    list_ai_usage_admin,
    list_credits_admin,
    list_emails_admin,
    list_errors_admin,
    list_imports_admin,
    list_subscriptions_admin,
    resolve_period,
    simulate_credit_cost_change,
)
from ai_metrics_service import get_ai_engine_metrics
from admin_models import (
    AdminActionResponse,
    AdminGrantCreditsRequest,
    AdminOverviewResponse,
    AdminSimulateCreditsRequest,
    AdminSimulateCreditsResponse,
    AdminSuspendRequest,
    AdminUserListResponse,
)
from auth import get_db

logger = logging.getLogger(__name__)

admin_router = APIRouter(prefix="/admin", tags=["admin"])


def _period_query(
    period: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
) -> tuple[str, str, str]:
    try:
        return resolve_period(period=period, from_date=from_date, to_date=to_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@admin_router.get("/overview", response_model=AdminOverviewResponse)
async def admin_overview(
    db=Depends(get_db),
    admin_user: dict = Depends(require_admin),
    period_params: tuple[str, str, str] = Depends(_period_query),
):
    period_key, start_iso, end_iso = period_params
    overview = await build_overview(db, period=period_key, start_iso=start_iso, end_iso=end_iso)
    overview["alerts"] = await build_alerts(db)
    return overview


@admin_router.get("/users", response_model=AdminUserListResponse)
async def admin_users(
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
    q: Optional[str] = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(ADMIN_PAGE_SIZE_DEFAULT, ge=1, le=100, alias="pageSize"),
):
    return await list_admin_users(db, q=q, page=page, page_size=page_size)


@admin_router.get("/users/{user_id}")
async def admin_user_detail(
    user_id: str,
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    detail = await get_admin_user_detail(db, user_id)
    if not detail:
        raise HTTPException(status_code=404, detail={"message": "User not found."})
    return detail


@admin_router.get("/subscriptions")
async def admin_subscriptions(
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(ADMIN_PAGE_SIZE_DEFAULT, ge=1, le=100, alias="pageSize"),
):
    return await list_subscriptions_admin(db, status=status, page=page, page_size=page_size)


@admin_router.get("/ai-usage")
async def admin_ai_usage(
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
    period_params: tuple[str, str, str] = Depends(_period_query),
    page: int = Query(1, ge=1),
    page_size: int = Query(ADMIN_PAGE_SIZE_DEFAULT, ge=1, le=100, alias="pageSize"),
):
    _, start_iso, end_iso = period_params
    return await list_ai_usage_admin(db, start_iso=start_iso, end_iso=end_iso, page=page, page_size=page_size)


@admin_router.get("/ai-engine/metrics")
async def admin_ai_engine_metrics(
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
    period_params: tuple[str, str, str] = Depends(_period_query),
):
    period_key, start_iso, end_iso = period_params
    metrics = await get_ai_engine_metrics(
        db,
        from_date=start_iso,
        to_date=end_iso,
    )
    metrics["periodKey"] = period_key
    return metrics


@admin_router.get("/imports")
async def admin_imports(
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
    period_params: tuple[str, str, str] = Depends(_period_query),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(ADMIN_PAGE_SIZE_DEFAULT, ge=1, le=100, alias="pageSize"),
):
    _, start_iso, end_iso = period_params
    return await list_imports_admin(
        db, start_iso=start_iso, end_iso=end_iso, status=status, page=page, page_size=page_size
    )


@admin_router.get("/credits")
async def admin_credits(
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
    period_params: tuple[str, str, str] = Depends(_period_query),
    page: int = Query(1, ge=1),
    page_size: int = Query(ADMIN_PAGE_SIZE_DEFAULT, ge=1, le=100, alias="pageSize"),
):
    _, start_iso, end_iso = period_params
    return await list_credits_admin(db, start_iso=start_iso, end_iso=end_iso, page=page, page_size=page_size)


@admin_router.get("/emails")
async def admin_emails(
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
    period_params: tuple[str, str, str] = Depends(_period_query),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(ADMIN_PAGE_SIZE_DEFAULT, ge=1, le=100, alias="pageSize"),
):
    _, start_iso, end_iso = period_params
    return await list_emails_admin(
        db, start_iso=start_iso, end_iso=end_iso, status=status, page=page, page_size=page_size
    )


@admin_router.get("/errors")
async def admin_errors(
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
    period_params: tuple[str, str, str] = Depends(_period_query),
    page: int = Query(1, ge=1),
    page_size: int = Query(ADMIN_PAGE_SIZE_DEFAULT, ge=1, le=100, alias="pageSize"),
):
    _, start_iso, end_iso = period_params
    return await list_errors_admin(db, start_iso=start_iso, end_iso=end_iso, page=page, page_size=page_size)


@admin_router.get("/system-health")
async def admin_system_health(
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    health = await check_system_health(db)
    health["alerts"] = await build_alerts(db)
    return health


@admin_router.post("/users/{user_id}/grant-credits", response_model=AdminActionResponse)
async def admin_grant_credits_endpoint(
    user_id: str,
    body: AdminGrantCreditsRequest,
    request: Request,
    db=Depends(get_db),
    admin_user: dict = Depends(require_admin),
):
    result = await admin_grant_credits(
        db,
        admin_user=admin_user,
        target_user_id=user_id,
        credits=body.credits,
        reason=body.reason,
        request_id=request_id(request),
        ip=client_ip(request),
    )
    return AdminActionResponse(message=result["message"], auditId=result["audit"]["id"])


@admin_router.post("/users/{user_id}/suspend", response_model=AdminActionResponse)
async def admin_suspend_endpoint(
    user_id: str,
    body: AdminSuspendRequest,
    request: Request,
    db=Depends(get_db),
    admin_user: dict = Depends(require_admin),
):
    result = await admin_suspend_account(
        db,
        admin_user=admin_user,
        target_user_id=user_id,
        reason=body.reason,
        request_id=request_id(request),
        ip=client_ip(request),
    )
    return AdminActionResponse(message=result["message"], auditId=result["audit"]["id"])


@admin_router.post("/users/{user_id}/resume", response_model=AdminActionResponse)
async def admin_resume_endpoint(
    user_id: str,
    request: Request,
    db=Depends(get_db),
    admin_user: dict = Depends(require_admin),
):
    result = await admin_resume_account(
        db,
        admin_user=admin_user,
        target_user_id=user_id,
        request_id=request_id(request),
        ip=client_ip(request),
    )
    return AdminActionResponse(message=result["message"], auditId=result["audit"]["id"])


@admin_router.post("/users/{user_id}/resend-verification", response_model=AdminActionResponse)
async def admin_resend_verification_endpoint(
    user_id: str,
    request: Request,
    db=Depends(get_db),
    admin_user: dict = Depends(require_admin),
):
    result = await admin_resend_verification(
        db,
        admin_user=admin_user,
        target_user_id=user_id,
        request_id=request_id(request),
        ip=client_ip(request),
    )
    return AdminActionResponse(message=result["message"], auditId=result["audit"]["id"])


@admin_router.post("/credits/simulate", response_model=AdminSimulateCreditsResponse)
async def admin_simulate_credits(
    body: AdminSimulateCreditsRequest,
    db=Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    try:
        _, start_iso, end_iso = resolve_period(period=body.period or "30d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc

    result = await simulate_credit_cost_change(
        db,
        action_key=body.actionKey,
        hypothetical_cost=body.hypotheticalCost,
        start_iso=start_iso,
        end_iso=end_iso,
    )
    return AdminSimulateCreditsResponse(**result)


@admin_router.get("/export/{resource}")
async def admin_export_csv(
    resource: str,
    request: Request,
    db=Depends(get_db),
    admin_user: dict = Depends(require_admin),
    period_params: tuple[str, str, str] = Depends(_period_query),
):
    _, start_iso, end_iso = period_params
    resource = resource.strip().lower()

    await log_admin_action(
        db,
        admin_user_id=admin_user["id"],
        action="export_csv",
        target_type="export",
        target_id=resource,
        metadata={"periodStart": start_iso, "periodEnd": end_iso},
        request_id=request_id(request),
        ip=client_ip(request),
    )

    output = io.StringIO()
    writer = csv.writer(output)

    if resource == "users":
        data = await list_admin_users(db, page=1, page_size=ADMIN_EXPORT_MAX_ROWS)
        writer.writerow(
            [
                "id",
                "email",
                "createdAt",
                "emailVerified",
                "accountStatus",
                "planId",
                "subscriptionStatus",
                "clientsCount",
                "importsCount",
                "creditsAvailable",
            ]
        )
        for row in data["items"]:
            writer.writerow(
                [
                    row.get("id"),
                    row.get("email"),
                    row.get("createdAt"),
                    row.get("emailVerified"),
                    row.get("accountStatus"),
                    row.get("planId"),
                    row.get("subscriptionStatus"),
                    row.get("clientsCount"),
                    row.get("importsCount"),
                    row.get("creditsAvailable"),
                ]
            )
    elif resource == "subscriptions":
        data = await list_subscriptions_admin(db, page=1, page_size=ADMIN_EXPORT_MAX_ROWS)
        writer.writerow(["id", "userId", "userEmail", "planId", "status", "currentPeriodEnd", "createdAt"])
        for row in data["items"]:
            writer.writerow(
                [
                    row.get("id"),
                    row.get("userId"),
                    row.get("userEmail"),
                    row.get("planId"),
                    row.get("status"),
                    row.get("currentPeriodEnd"),
                    row.get("createdAt"),
                ]
            )
    elif resource == "ai-usage":
        data = await list_ai_usage_admin(db, start_iso=start_iso, end_iso=end_iso, page=1, page_size=ADMIN_EXPORT_MAX_ROWS)
        writer.writerow(
            ["id", "userId", "actionKey", "model", "totalTokens", "estimatedCostUsd", "costKnown", "success", "createdAt"]
        )
        for row in data["items"]:
            writer.writerow(
                [
                    row.get("id"),
                    row.get("userId"),
                    row.get("actionKey"),
                    row.get("model"),
                    row.get("totalTokens"),
                    row.get("estimatedCostUsd"),
                    row.get("costKnown"),
                    row.get("success"),
                    row.get("createdAt"),
                ]
            )
    elif resource == "credits":
        data = await list_credits_admin(db, start_iso=start_iso, end_iso=end_iso, page=1, page_size=ADMIN_EXPORT_MAX_ROWS)
        writer.writerow(["id", "userId", "type", "costApplied", "actionKey", "source", "label", "createdAt"])
        for row in data["items"]:
            writer.writerow(
                [
                    row.get("id"),
                    row.get("userId"),
                    row.get("type"),
                    row.get("costApplied"),
                    row.get("actionKey"),
                    row.get("source"),
                    row.get("label"),
                    row.get("createdAt"),
                ]
            )
    elif resource == "imports":
        data = await list_imports_admin(db, start_iso=start_iso, end_iso=end_iso, page=1, page_size=ADMIN_EXPORT_MAX_ROWS)
        writer.writerow(["id", "userId", "status", "detectedKind", "fileName", "sizeBytes", "createdAt"])
        for row in data["items"]:
            file_info = row.get("file") or {}
            writer.writerow(
                [
                    row.get("id"),
                    row.get("userId"),
                    row.get("status"),
                    row.get("detectedKind"),
                    file_info.get("name"),
                    file_info.get("sizeBytes"),
                    row.get("createdAt"),
                ]
            )
    elif resource == "emails":
        data = await list_emails_admin(db, start_iso=start_iso, end_iso=end_iso, page=1, page_size=ADMIN_EXPORT_MAX_ROWS)
        writer.writerow(["id", "userId", "templateKey", "to", "status", "attempts", "createdAt", "lastError"])
        for row in data["items"]:
            writer.writerow(
                [
                    row.get("id"),
                    row.get("userId"),
                    row.get("templateKey"),
                    row.get("to"),
                    row.get("status"),
                    row.get("attempts"),
                    row.get("createdAt"),
                    (row.get("lastError") or "")[:200],
                ]
            )
    else:
        raise HTTPException(status_code=404, detail={"message": "Unknown export resource."})

    output.seek(0)
    filename = f"memoryhub-admin-{resource}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
