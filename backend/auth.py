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

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "168"))
COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = JWT_EXPIRE_HOURS * 3600
IS_PRODUCTION = os.environ.get("ENV", "development").lower() == "production"

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
    response.delete_cookie(key=COOKIE_NAME, path="/")


async def get_current_user(request: Request, db=Depends(get_db)) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail={"message": "Not authenticated."})
    user_id = decode_access_token(token)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "passwordHash": 0, "emailVerificationToken": 0, "passwordResetToken": 0, "passwordResetExpires": 0})
    if not user:
        raise HTTPException(status_code=401, detail={"message": "User not found."})
    return user


@auth_router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest, response: Response, db=Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    verification_token = secrets.token_urlsafe(32)
    user_doc = {
        "id": str(uuid.uuid4()),
        "firstName": body.firstName,
        "lastName": body.lastName,
        "companyName": body.companyName,
        "email": body.email,
        "passwordHash": hash_password(body.password),
        "emailVerified": False,
        "emailVerificationToken": verification_token,
        "passwordResetToken": None,
        "passwordResetExpires": None,
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        await db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail={"message": "An account with this email already exists."},
        )

    logger.info("Verification email pending for %s (token stored, not sent)", body.email)

    token = create_access_token(user_doc["id"])
    set_auth_cookie(response, token)
    return AuthResponse(
        message="Account created. A verification email will be sent shortly.",
        user=user_public(user_doc),
    )


@auth_router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, response: Response, db=Depends(get_db)):
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["passwordHash"]):
        raise HTTPException(
            status_code=401,
            detail={"message": "Invalid email or password."},
        )

    token = create_access_token(user["id"])
    set_auth_cookie(response, token)
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
async def forgot_password(body: ForgotPasswordRequest, db=Depends(get_db)):
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
        logger.info("Password reset token generated for %s (not sent)", body.email)

    return MessageResponse(
        message="If an account exists for this email, a reset link will be sent shortly."
    )


@auth_router.post("/verify-email", response_model=MessageResponse)
async def verify_email(body: VerifyEmailRequest, db=Depends(get_db)):
    user = await db.users.find_one({"emailVerificationToken": body.token})
    if not user:
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
                "updatedAt": now,
            }
        },
    )
    return MessageResponse(message="Email verified successfully.")
