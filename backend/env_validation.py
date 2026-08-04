"""Strict environment validation for production startup."""

from __future__ import annotations

import os
import sys
from typing import Iterable
from urllib.parse import urlparse

DEV_JWT_SECRET = "dev-jwt-secret-change-in-production"
DEV_INTEGRATIONS_TOKEN_KEY = "dev-integrations-token-key-change-me"
ENV_NAME = os.environ.get("ENV", "development").lower()
IS_PRODUCTION = ENV_NAME == "production"
IS_STAGING = ENV_NAME == "staging"
IS_DEPLOYED = IS_PRODUCTION or IS_STAGING
DEFAULT_SENTRY_USER_SALT = "memoryhub-dev-sentry-salt"


def _require(name: str, errors: list[str]) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        errors.append(f"{name} is required in production.")
    return value


def _require_deployed(name: str, errors: list[str]) -> str:
    value = os.environ.get(name, "").strip()
    if not value and IS_DEPLOYED:
        errors.append(f"{name} is required when ENV is production or staging.")
    return value


def _validate_url(name: str, value: str, errors: list[str], *, require_https: bool = False) -> None:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        errors.append(f"{name} must be a valid URL (got {value!r}).")
    elif require_https and parsed.scheme != "https" and IS_PRODUCTION:
        errors.append(f"{name} must use HTTPS in production (got {value!r}).")


def _validate_origins(name: str, value: str, errors: list[str]) -> list[str]:
    origins = [origin.strip() for origin in value.split(",") if origin.strip()]
    if not origins:
        errors.append(f"{name} must contain at least one origin.")
        return []
    if "*" in origins:
        errors.append(f"{name} must not contain '*' in production.")
    for origin in origins:
        parsed = urlparse(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append(f"{name} contains invalid origin: {origin!r}")
        elif IS_PRODUCTION and parsed.scheme != "https":
            errors.append(f"{name} origin must use HTTPS in production: {origin!r}")
    return origins


def _frontend_origin(frontend_url: str) -> str | None:
    parsed = urlparse(frontend_url)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def validate_production_env() -> None:
    if not IS_DEPLOYED:
        return

    errors: list[str] = []

    mongo_url = _require_deployed("MONGO_URL", errors)
    if mongo_url and not mongo_url.startswith(("mongodb://", "mongodb+srv://")):
        errors.append("MONGO_URL must start with mongodb:// or mongodb+srv://.")
    if IS_PRODUCTION and mongo_url and "@" not in mongo_url.split("//", 1)[-1]:
        errors.append(
            "MONGO_URL must include credentials in production (use docker-compose.prod.yml)."
        )

    _require_deployed("DB_NAME", errors)

    jwt_secret = _require_deployed("JWT_SECRET", errors)
    if jwt_secret:
        if jwt_secret == DEV_JWT_SECRET or len(jwt_secret) < 32:
            errors.append("JWT_SECRET must be a strong random value (>= 32 chars).")

    cors_raw = _require_deployed("CORS_ORIGINS", errors)
    cors_origins = _validate_origins("CORS_ORIGINS", cors_raw, errors) if cors_raw else []

    frontend_url = _require_deployed("FRONTEND_URL", errors)
    if frontend_url:
        _validate_url("FRONTEND_URL", frontend_url, errors, require_https=IS_PRODUCTION)
        expected_origin = _frontend_origin(frontend_url)
        if expected_origin and expected_origin not in cors_origins:
            errors.append(
                f"CORS_ORIGINS must include FRONTEND_URL origin ({expected_origin})."
            )

    public_url = os.environ.get("FRONTEND_PUBLIC_URL", "").strip() or frontend_url
    if public_url:
        _validate_url("FRONTEND_PUBLIC_URL", public_url, errors, require_https=IS_PRODUCTION)

    backend_public = os.environ.get("BACKEND_PUBLIC_URL", "").strip() or os.environ.get(
        "PUBLIC_APP_URL", ""
    ).strip()
    if IS_PRODUCTION and not backend_public:
        errors.append("BACKEND_PUBLIC_URL or PUBLIC_APP_URL is required in production.")
    elif backend_public:
        _validate_url("BACKEND_PUBLIC_URL", backend_public, errors, require_https=IS_PRODUCTION)

    sentry_salt = _require_deployed("SENTRY_USER_SALT", errors)
    if sentry_salt == DEFAULT_SENTRY_USER_SALT:
        errors.append("SENTRY_USER_SALT must be changed from the default dev value.")

    storage_backend = os.environ.get("STORAGE_BACKEND", "local").lower()
    if storage_backend == "local":
        upload_dir = _require_deployed("LOCAL_UPLOAD_DIR", errors) if IS_PRODUCTION else os.environ.get(
            "LOCAL_UPLOAD_DIR", ""
        ).strip()
        if IS_PRODUCTION and upload_dir and upload_dir.startswith("."):
            errors.append("LOCAL_UPLOAD_DIR must be an absolute path in production (e.g. /app/uploads).")
    elif storage_backend == "s3":
        _require_deployed("S3_BUCKET", errors)

    analyzer_provider = os.environ.get("ANALYZER_PROVIDER", "mock").lower()
    if IS_PRODUCTION and analyzer_provider != "openai":
        errors.append("ANALYZER_PROVIDER must be 'openai' in production.")
    if analyzer_provider == "openai":
        _require_deployed("OPENAI_API_KEY", errors)

    if IS_PRODUCTION:
        credits = os.environ.get("CREDITS_ENFORCED", "").lower()
        if credits not in {"1", "true", "yes"}:
            errors.append("CREDITS_ENFORCED must be true in production.")

    _validate_email_config(errors)
    _validate_stripe_config(errors)
    _validate_google_contacts_config(errors)
    _validate_staging_providers(errors)
    _validate_dev_credit_purchases(errors)
    _validate_dev_runtime_flags(errors)

    _validate_positive_int("MAX_LIST_ITEMS", errors)
    _validate_positive_int("MAX_UPLOAD_BYTES", errors)

    if errors:
        label = "production" if IS_PRODUCTION else "staging"
        print(f"FATAL: Invalid {label} environment configuration:", file=sys.stderr)
        for error in _unique(errors):
            print(f"  - {error}", file=sys.stderr)
        sys.exit(1)


def _validate_email_config(errors: list[str]) -> None:
    if not IS_DEPLOYED:
        return
    provider = os.environ.get("EMAIL_PROVIDER", "smtp").strip().lower()
    if provider != "smtp":
        errors.append("EMAIL_PROVIDER must be 'smtp' in staging and production.")
        return
    _require_deployed("SMTP_HOST", errors)
    if not os.environ.get("SMTP_FROM_EMAIL", "").strip() and not os.environ.get("SMTP_FROM", "").strip():
        errors.append("SMTP_FROM_EMAIL is required in staging and production.")
    _require_deployed("SUPPORT_EMAIL", errors)


def _validate_staging_providers(errors: list[str]) -> None:
    if not IS_STAGING:
        return

    analyzer = os.environ.get("ANALYZER_PROVIDER", "mock").lower()
    if analyzer != "openai":
        errors.append("ANALYZER_PROVIDER must be 'openai' in staging.")
    _require_deployed("OPENAI_API_KEY", errors)

    email = os.environ.get("EMAIL_PROVIDER", "smtp").strip().lower()
    if email in {"fake", "console"}:
        errors.append("EMAIL_PROVIDER must not be fake or console in staging.")

    stripe_backend = os.environ.get("STRIPE_BACKEND", "stripe").strip().lower()
    if stripe_backend in {"fake", "mock"}:
        errors.append("STRIPE_BACKEND must not be fake or mock in staging.")

    credits = os.environ.get("CREDITS_ENFORCED", "").lower()
    if credits not in {"1", "true", "yes"}:
        errors.append("CREDITS_ENFORCED must be true in staging.")

    secret = os.environ.get("STRIPE_SECRET_KEY", "")
    if secret and not secret.startswith("sk_test_"):
        errors.append("STRIPE_SECRET_KEY must be a test key (sk_test_...) in staging.")


def _validate_stripe_config(errors: list[str]) -> None:
    if not IS_DEPLOYED:
        return
    for name in (
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRICE_SOLO",
        "STRIPE_PRICE_PRO",
        "STRIPE_PRICE_TEAM",
        "STRIPE_SUCCESS_URL",
        "STRIPE_CANCEL_URL",
    ):
        _require_deployed(name, errors)
    secret = os.environ.get("STRIPE_SECRET_KEY", "")
    if IS_PRODUCTION and secret and not secret.startswith("sk_live_"):
        errors.append("STRIPE_SECRET_KEY must be a live key (sk_live_...) in production.")
    if IS_STAGING and secret and not secret.startswith("sk_test_"):
        errors.append("STRIPE_SECRET_KEY must be a test key (sk_test_...) in staging.")


def _google_contacts_credentials_complete(
    client_id: str, client_secret: str, redirect_uri: str
) -> bool:
    return bool(client_id and client_secret and redirect_uri)


def _gmail_credentials_complete(
    client_id: str, client_secret: str, redirect_uri: str, gmail_redirect: str
) -> bool:
    return bool(client_id and client_secret and (gmail_redirect or redirect_uri))


def _validate_google_contacts_config(errors: list[str]) -> None:
    """Google OAuth credentials are optional — partial sets must be complete."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "").strip()
    gmail_redirect = os.environ.get("GOOGLE_GMAIL_REDIRECT_URI", "").strip()
    any_set = bool(client_id or client_secret or redirect_uri or gmail_redirect)
    if not any_set:
        return
    if not client_id:
        errors.append("GOOGLE_CLIENT_ID is required when Google credentials are partially set.")
    if not client_secret:
        errors.append("GOOGLE_CLIENT_SECRET is required when Google credentials are partially set.")
    if not redirect_uri and not gmail_redirect:
        errors.append(
            "GOOGLE_REDIRECT_URI or GOOGLE_GMAIL_REDIRECT_URI is required when Google credentials are set."
        )
    if redirect_uri:
        _validate_url("GOOGLE_REDIRECT_URI", redirect_uri, errors, require_https=IS_PRODUCTION)
    if gmail_redirect:
        _validate_url(
            "GOOGLE_GMAIL_REDIRECT_URI", gmail_redirect, errors, require_https=IS_PRODUCTION
        )

    contacts_complete = _google_contacts_credentials_complete(client_id, client_secret, redirect_uri)
    gmail_complete = _gmail_credentials_complete(
        client_id, client_secret, redirect_uri, gmail_redirect
    )

    provider_mode = os.environ.get("INTEGRATIONS_CONTACTS_PROVIDER", "").strip().lower()
    if provider_mode and provider_mode not in {"google", "mock"}:
        errors.append("INTEGRATIONS_CONTACTS_PROVIDER must be 'google' or 'mock' when set.")
    if IS_DEPLOYED and provider_mode == "mock":
        errors.append("INTEGRATIONS_CONTACTS_PROVIDER=mock is not allowed in staging or production.")
    if IS_DEPLOYED and provider_mode == "google" and not contacts_complete:
        errors.append(
            "INTEGRATIONS_CONTACTS_PROVIDER=google requires GOOGLE_CLIENT_ID, "
            "GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
        )

    gmail_mode = os.environ.get("INTEGRATIONS_GMAIL_PROVIDER", "").strip().lower()
    if gmail_mode and gmail_mode not in {"google", "mock"}:
        errors.append("INTEGRATIONS_GMAIL_PROVIDER must be 'google' or 'mock' when set.")
    if IS_DEPLOYED and gmail_mode == "mock":
        errors.append("INTEGRATIONS_GMAIL_PROVIDER=mock is not allowed in staging or production.")
    if IS_DEPLOYED and gmail_mode == "google" and not gmail_complete:
        errors.append(
            "INTEGRATIONS_GMAIL_PROVIDER=google requires GOOGLE_CLIENT_ID, "
            "GOOGLE_CLIENT_SECRET, and GOOGLE_GMAIL_REDIRECT_URI or GOOGLE_REDIRECT_URI."
        )

    token_key = os.environ.get("INTEGRATIONS_TOKEN_KEY", "").strip()
    jwt_secret = os.environ.get("JWT_SECRET", "").strip()
    if IS_DEPLOYED and any_set and not token_key:
        errors.append("INTEGRATIONS_TOKEN_KEY is required when Google integrations are configured.")
    if IS_DEPLOYED and any_set and token_key:
        if len(token_key) < 32:
            errors.append(
                "INTEGRATIONS_TOKEN_KEY must be at least 32 characters when Google integrations are configured."
            )
        if token_key == DEV_INTEGRATIONS_TOKEN_KEY:
            errors.append(
                "INTEGRATIONS_TOKEN_KEY must not use the development default when Google integrations are configured."
            )
        if jwt_secret and token_key == jwt_secret:
            errors.append(
                "INTEGRATIONS_TOKEN_KEY must be a dedicated secret, not JWT_SECRET, "
                "when Google integrations are configured."
            )


def _validate_dev_runtime_flags(errors: list[str]) -> None:
    if not IS_DEPLOYED:
        return
    if os.environ.get("E2E_DISABLE_RATE_LIMIT", "").lower() in {"1", "true", "yes"}:
        errors.append("E2E_DISABLE_RATE_LIMIT must not be set in staging or production.")
    if os.environ.get("ALLOW_E2E_SEED", "").lower() in {"1", "true", "yes"}:
        errors.append("ALLOW_E2E_SEED must not be set in staging or production.")


def _validate_dev_credit_purchases(errors: list[str]) -> None:
    enabled = os.environ.get("DEV_CREDIT_PURCHASES_ENABLED", "").lower() in {"1", "true", "yes"}
    if not enabled:
        return
    if IS_DEPLOYED:
        errors.append(
            "DEV_CREDIT_PURCHASES_ENABLED must not be true when ENV is staging or production."
        )


def _validate_positive_int(name: str, errors: list[str]) -> None:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return
    try:
        if int(raw) <= 0:
            errors.append(f"{name} must be a positive integer.")
    except ValueError:
        errors.append(f"{name} must be a positive integer.")


def _unique(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered
