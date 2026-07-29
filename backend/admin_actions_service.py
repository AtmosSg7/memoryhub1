"""Privileged admin actions — audited, server-side only."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from admin_audit_service import log_admin_action
from admin_constants import USER_ROLE_USER
from billing_service import grant_admin_credits
from subscription_service import resume_subscription, suspend_subscription
from transactional_email_service import send_verification_email

EMAIL_VERIFICATION_TTL_HOURS = int(__import__("os").environ.get("EMAIL_VERIFICATION_TTL_HOURS", "72"))


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_target_user(db, user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail={"message": "User not found."})
    return user


async def admin_grant_credits(
    db,
    *,
    admin_user: dict,
    target_user_id: str,
    credits: int,
    reason: str,
    request_id: Optional[str] = None,
    ip: Optional[str] = None,
) -> dict:
    target = await _get_target_user(db, target_user_id)
    balance = await grant_admin_credits(db, target_user_id, credits, reason=reason)
    audit = await log_admin_action(
        db,
        admin_user_id=admin_user["id"],
        action="grant_credits",
        target_type="user",
        target_id=target_user_id,
        reason=reason,
        metadata={"credits": credits, "email": target.get("email")},
        request_id=request_id,
        ip=ip,
    )
    return {"message": f"Granted {credits} credits.", "balance": balance, "audit": audit}


async def admin_suspend_account(
    db,
    *,
    admin_user: dict,
    target_user_id: str,
    reason: str,
    request_id: Optional[str] = None,
    ip: Optional[str] = None,
) -> dict:
    target = await _get_target_user(db, target_user_id)
    if target.get("accountStatus") == "suspended":
        raise HTTPException(status_code=409, detail={"message": "Account already suspended."})
    if target.get("role") == "admin":
        raise HTTPException(status_code=403, detail={"message": "Cannot suspend an admin account."})

    await db.users.update_one(
        {"id": target_user_id},
        {
            "$set": {
                "accountStatus": "suspended",
                "suspendedAt": _utc_now(),
                "suspendedReason": reason.strip(),
                "updatedAt": _utc_now(),
            }
        },
    )

    try:
        await suspend_subscription(db, target_user_id, reason=reason, idempotency_key=f"admin-suspend:{target_user_id}")
    except Exception:
        pass

    audit = await log_admin_action(
        db,
        admin_user_id=admin_user["id"],
        action="suspend_account",
        target_type="user",
        target_id=target_user_id,
        reason=reason,
        metadata={"email": target.get("email")},
        request_id=request_id,
        ip=ip,
    )
    return {"message": "Account suspended.", "audit": audit}


async def admin_resume_account(
    db,
    *,
    admin_user: dict,
    target_user_id: str,
    request_id: Optional[str] = None,
    ip: Optional[str] = None,
) -> dict:
    target = await _get_target_user(db, target_user_id)
    if target.get("accountStatus") != "suspended":
        raise HTTPException(status_code=409, detail={"message": "Account is not suspended."})

    await db.users.update_one(
        {"id": target_user_id},
        {
            "$set": {
                "accountStatus": "active",
                "updatedAt": _utc_now(),
            },
            "$unset": {"suspendedAt": "", "suspendedReason": ""},
        },
    )

    try:
        await resume_subscription(db, target_user_id, idempotency_key=f"admin-resume:{target_user_id}")
    except Exception:
        pass

    audit = await log_admin_action(
        db,
        admin_user_id=admin_user["id"],
        action="resume_account",
        target_type="user",
        target_id=target_user_id,
        metadata={"email": target.get("email")},
        request_id=request_id,
        ip=ip,
    )
    return {"message": "Account resumed.", "audit": audit}


async def admin_resend_verification(
    db,
    *,
    admin_user: dict,
    target_user_id: str,
    request_id: Optional[str] = None,
    ip: Optional[str] = None,
) -> dict:
    target = await _get_target_user(db, target_user_id)
    if target.get("emailVerified"):
        raise HTTPException(status_code=409, detail={"message": "Email already verified."})

    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_TTL_HOURS)).isoformat()
    await db.users.update_one(
        {"id": target_user_id},
        {
            "$set": {
                "emailVerificationToken": token,
                "emailVerificationExpires": expires,
                "updatedAt": _utc_now(),
            }
        },
    )

    greeting = (target.get("firstName") or "").strip() or "there"
    await send_verification_email(
        db,
        user_id=target_user_id,
        to=target["email"],
        greeting=greeting,
        verify_token=token,
    )

    audit = await log_admin_action(
        db,
        admin_user_id=admin_user["id"],
        action="resend_verification",
        target_type="user",
        target_id=target_user_id,
        metadata={"email": target.get("email")},
        request_id=request_id,
        ip=ip,
    )
    return {"message": "Verification email sent.", "audit": audit}
