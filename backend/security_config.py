import os
import sys

from env_validation import IS_DEPLOYED, validate_production_env

DEV_JWT_SECRET = "dev-jwt-secret-change-in-production"
IS_PRODUCTION = os.environ.get("ENV", "development").lower() == "production"
MAX_LIST_ITEMS = int(os.environ.get("MAX_LIST_ITEMS", "500"))


def validate_security_config() -> None:
    if IS_DEPLOYED:
        validate_production_env()
    jwt_secret = os.environ.get("JWT_SECRET", DEV_JWT_SECRET)
    if IS_PRODUCTION:
        if not jwt_secret or jwt_secret == DEV_JWT_SECRET or len(jwt_secret) < 32:
            print(
                "FATAL: Set JWT_SECRET to a strong random value (>= 32 chars) in production.",
                file=sys.stderr,
            )
            sys.exit(1)
        cors = os.environ.get("CORS_ORIGINS", "").strip()
        if not cors or cors == "*":
            print(
                "FATAL: Set CORS_ORIGINS to an explicit allowlist in production (not *).",
                file=sys.stderr,
            )
            sys.exit(1)


def cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if IS_PRODUCTION:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
