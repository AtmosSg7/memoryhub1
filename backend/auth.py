import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pymongo.errors import DuplicateKeyError

logger = logging.getLogger(__name__)

from rate_limit import rate_limit
from security_config import DEV_JWT_SECRET, IS_PRODUCTION
from admin_constants import USER_ROLE_USER
from admin_roles import is_admin_user

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.environ.get("JWT_SECRET", DEV_JWT_SECRET)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "168"))
COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = JWT_EXPIRE_HOURS * 3600
EMAIL_VERIFICATION_TTL_HOURS = int(os.environ.get("EMAIL_VERIFICATION_TTL_HOURS", "72"))

login_rate_limit = rate_limit(max_requests=10, window_seconds=900)
register_rate_limit = rate_limit(max_requests=5, window_seconds=3600)
forgot_password_rate_limit = rate_limit(max_requests=5, window_seconds=3600)
reset_password_rate_limit = rate_limit(max_requests=10, window_seconds=3600)
verify_email_rate_limit = rate_limit(max_requests=20, window_seconds=3600)

auth_router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    companyName: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("firstName", "lastName", "companyName")
    @classmethod
    def strip_required(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("This field cannot be empty.")
        return stripped

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=1)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    firstName: str
    lastName: str
    companyName: str
    email: str
    emailVerified: bool = False
    isAdmin: bool = False
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class AuthResponse(BaseModel):
    message: str
    user: UserPublic


def get_db(request: Request):
    return request.app.state.db


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def build_user_document(
    *,
    first_name: str,
    last_name: str,
    company_name: str,
    email: str,
    password: str,
    email_verified: bool = False,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    verification_token = None if email_verified else secrets.token_urlsafe(32)
    verification_expires = None
    if verification_token:
        verification_expires = (
            datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_TTL_HOURS)
        ).isoformat()
    return {
        "id": str(uuid.uuid4()),
        "firstName": first_name,
        "lastName": last_name,
        "companyName": company_name,
        "email": email.strip().lower(),
        "passwordHash": hash_password(password),
        "emailVerified": email_verified,
        "emailVerificationToken": verification_token,
        "emailVerificationExpires": verification_expires,
        "passwordResetToken": None,
        "passwordResetExpires": None,
        "role": USER_ROLE_USER,
        "accountStatus": "active",
        "companyProfile": {
            "legalName": company_name,
            "email": email.strip().lower(),
            "country": "FR",
            "paymentDelayDays": 30,
            "defaultVatRate": 20,
            "currency": "EUR",
            "quotePrefix": "DEV",
            "invoicePrefix": "FAC",
            "primaryColor": "#0A2540",
            "updatedAt": now,
        },
        "createdAt": now,
        "updatedAt": now,
    }


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail={"message": "Invalid token."})
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail={"message": "Session expired."})
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail={"message": "Invalid token."})


def user_public(doc: dict) -> UserPublic:
    return UserPublic(
        id=doc["id"],
        firstName=doc["firstName"],
        lastName=doc["lastName"],
        companyName=doc["companyName"],
        email=doc["email"],
        emailVerified=doc.get("emailVerified", False),
        isAdmin=is_admin_user(doc),
        createdAt=doc.get("createdAt"),
        updatedAt=doc.get("updatedAt"),
    )


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=IS_PRODUCTION,
        samesite="lax",
    )


async def get_current_user(request: Request, db=Depends(get_db)) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail={"message": "Not authenticated."})
    user_id = decode_access_token(token)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "passwordHash": 0, "emailVerificationToken": 0, "passwordResetToken": 0, "passwordResetExpires": 0})
    if not user:
        raise HTTPException(status_code=401, detail={"message": "User not found."})
    if user.get("accountStatus") == "suspended":
        raise HTTPException(status_code=403, detail={"message": "Account suspended."})
    return user


@auth_router.post("/register", response_model=AuthResponse, status_code=201)
async def register(
    body: RegisterRequest,
    response: Response,
    db=Depends(get_db),
    _rate=Depends(register_rate_limit),
):
    user_doc = build_user_document(
        first_name=body.firstName,
        last_name=body.lastName,
        company_name=body.companyName,
        email=body.email,
        password=body.password,
    )
    try:
        await db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail={"message": "An account with this email already exists."},
        )

    try:
        from subscription_service import create_subscription

        credits_enforced = os.environ.get("CREDITS_ENFORCED", "").lower() in {"1", "true", "yes"}
        env = os.environ.get("ENV", "development").lower()
        if credits_enforced or env in {"staging", "production"}:
            await create_subscription(db, user_doc["id"], "solo", start_with_trial=True)
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "Could not start trial subscription for user %s", user_doc["id"], exc_info=True
        )

    from transactional_email_service import send_verification_email

    greeting = body.firstName.strip()
    if user_doc.get("emailVerificationToken"):
        await send_verification_email(
            db,
            user_id=user_doc["id"],
            to=body.email,
            greeting=greeting,
            verify_token=user_doc["emailVerificationToken"],
        )

    token = create_access_token(user_doc["id"])
    set_auth_cookie(response, token)
    return AuthResponse(
        message="Welcome to MemoryHub — your account is ready.",
        user=user_public(user_doc),
    )


@auth_router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db=Depends(get_db),
    _rate=Depends(login_rate_limit),
):
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["passwordHash"]):
        from observability import log_event

        log_event("auth.login", result="failed", error="invalid_credentials")
        raise HTTPException(
            status_code=401,
            detail={"message": "Invalid email or password."},
        )
    if user.get("accountStatus") == "suspended":
        from observability import log_event

        log_event("auth.login", user_id=user.get("id"), result="failed", error="suspended")
        raise HTTPException(
            status_code=403,
            detail={"message": "Account suspended. Contact support."},
        )

    token = create_access_token(user["id"])
    set_auth_cookie(response, token)
    from observability import log_event

    log_event("auth.login", user_id=user["id"], result="ok")
    return AuthResponse(
        message="Logged in successfully.",
        user=user_public(user),
    )


@auth_router.post("/logout", response_model=MessageResponse)
async def logout(response: Response):
    clear_auth_cookie(response)
    return MessageResponse(message="Logged out successfully.")


@auth_router.get("/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    return user_public(current_user)


@auth_router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    db=Depends(get_db),
    _rate=Depends(forgot_password_rate_limit),
):
    user = await db.users.find_one({"email": body.email})
    if user:
        reset_token = secrets.token_urlsafe(32)
        expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "passwordResetToken": reset_token,
                    "passwordResetExpires": expires,
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        from transactional_email_service import send_password_reset_email

        greeting = (user.get("firstName") or "").strip() or "there"
        await send_password_reset_email(
            db,
            user_id=user["id"],
            to=body.email,
            greeting=greeting,
            reset_token=reset_token,
        )

    return MessageResponse(
        message="If an account exists for this address, you will receive password reset instructions by email."
    )


@auth_router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordRequest,
    db=Depends(get_db),
    _rate=Depends(reset_password_rate_limit),
):
    user = await db.users.find_one({"passwordResetToken": body.token})
    if not user:
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid or expired reset token."},
        )

    expires_at = user.get("passwordResetExpires")
    if expires_at:
        exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp_dt:
            raise HTTPException(
                status_code=400,
                detail={"message": "Invalid or expired reset token."},
            )

    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "passwordHash": hash_password(body.password),
                "passwordResetToken": None,
                "passwordResetExpires": None,
                "updatedAt": now,
            }
        },
    )
    try:
        from transactional_email_service import send_password_changed_email

        greeting = (user.get("firstName") or "").strip() or "there"
        await send_password_changed_email(
            db,
            user_id=user["id"],
            to=user["email"],
            greeting=greeting,
        )
    except Exception:
        pass
    return MessageResponse(message="Password updated successfully. You can sign in with your new password.")


@auth_router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    body: VerifyEmailRequest,
    db=Depends(get_db),
    _rate=Depends(verify_email_rate_limit),
):
    user = await db.users.find_one({"emailVerificationToken": body.token})
    if not user:
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid or expired verification token."},
        )

    expires_at = user.get("emailVerificationExpires")
    if expires_at:
        exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp_dt:
            raise HTTPException(
                status_code=400,
                detail={"message": "Invalid or expired verification token."},
            )

    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "emailVerified": True,
                "emailVerificationToken": None,
                "emailVerificationExpires": None,
                "updatedAt": now,
            }
        },
    )
    try:
        from transactional_email_service import send_welcome_email

        greeting = (user.get("firstName") or "").strip() or "there"
        await send_welcome_email(
            db,
            user_id=user["id"],
            to=user["email"],
            greeting=greeting,
        )
    except Exception:
        pass
    return MessageResponse(message="Email verified successfully.")
