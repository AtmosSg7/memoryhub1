"""Centralized logging and Sentry observability for the backend."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Any, Optional

import jwt
import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from auth import COOKIE_NAME, JWT_ALGORITHM, JWT_SECRET
from security_config import IS_PRODUCTION

SENSITIVE_KEY = re.compile(
    r"password|token|secret|authorization|cookie|api[_-]?key|jwt|bearer|access_token",
    re.IGNORECASE,
)
BEARER_PATTERN = re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE)
JWT_PATTERN = re.compile(r"eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+")

DEFAULT_USER_SALT = "memoryhub-dev-sentry-salt"
USER_SALT = os.environ.get("SENTRY_USER_SALT", DEFAULT_USER_SALT)
ENVIRONMENT = os.environ.get("ENV", "development").lower()
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

_observability_initialized = False


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def log_event(
    action: str,
    *,
    user_id: Optional[str] = None,
    result: str = "ok",
    duration_ms: Optional[float] = None,
    error: Optional[str] = None,
    **fields: Any,
) -> None:
    """Structured business-event log without secrets or CRM payloads."""
    logger = get_logger("memoryhub.events")
    payload = scrub_dict(
        {
            "action": action,
            "result": result,
            "userId": anonymize_user_id(user_id) if user_id else None,
            "durationMs": round(duration_ms, 1) if duration_ms is not None else None,
            "error": (error or "")[:300] or None,
            **fields,
        }
    )
    # Drop empty keys for readability
    compact = {key: value for key, value in payload.items() if value is not None}
    if result in {"error", "failed"} or error:
        logger.error("%s | %s", action, compact)
    else:
        logger.info("%s | %s", action, compact)


def anonymize_user_id(user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None
    digest = hashlib.sha256(f"{USER_SALT}:{user_id}".encode("utf-8")).hexdigest()
    return f"u_{digest[:16]}"


def _scrub_value(key: str, value: Any) -> Any:
    if SENSITIVE_KEY.search(key):
        return "[Filtered]"
    if isinstance(value, str):
        if BEARER_PATTERN.search(value) or JWT_PATTERN.search(value):
            return "[Filtered]"
    if isinstance(value, dict):
        return scrub_dict(value)
    if isinstance(value, list):
        return [_scrub_value(str(index), item) for index, item in enumerate(value)]
    return value


def scrub_dict(data: Optional[dict]) -> dict:
    if not data:
        return {}
    scrubbed: dict = {}
    for key, value in data.items():
        scrubbed[key] = _scrub_value(str(key), value)
    return scrubbed


def scrub_sentry_event(event: dict, _hint: dict) -> Optional[dict]:
    request = event.get("request")
    if isinstance(request, dict):
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = scrub_dict(headers)
        cookies = request.get("cookies")
        if isinstance(cookies, dict):
            request["cookies"] = scrub_dict(cookies)
        data = request.get("data")
        if isinstance(data, dict):
            request["data"] = scrub_dict(data)
    extra = event.get("extra")
    if isinstance(extra, dict):
        event["extra"] = scrub_dict(extra)
    user = event.get("user")
    if isinstance(user, dict):
        event["user"] = {key: value for key, value in user.items() if key == "id"}
    return event


class SensitiveDataFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = BEARER_PATTERN.sub("[Filtered]", record.msg)
            record.msg = JWT_PATTERN.sub("[Filtered]", record.msg)
        if record.args:
            record.args = tuple(
                BEARER_PATTERN.sub("[Filtered]", str(arg)) if isinstance(arg, str) else arg
                for arg in record.args
            )
        return True


def configure_logging() -> None:
    root = logging.getLogger()
    if root.handlers:
        root.setLevel(LOG_LEVEL)
        return

    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    )
    handler.addFilter(SensitiveDataFilter())
    root.addHandler(handler)
    root.setLevel(LOG_LEVEL)


def init_sentry() -> None:
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        if IS_PRODUCTION:
            logging.getLogger(__name__).warning(
                "SENTRY_DSN is not set; unhandled errors will only be logged locally."
            )
        return

    traces_sample_rate = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1"))

    sentry_sdk.init(
        dsn=dsn,
        environment=ENVIRONMENT,
        traces_sample_rate=traces_sample_rate,
        send_default_pii=False,
        before_send=scrub_sentry_event,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
    )


def init_observability() -> None:
    global _observability_initialized
    if _observability_initialized:
        return
    configure_logging()
    init_sentry()
    _observability_initialized = True


def _decode_user_id_from_request(request: Request) -> Optional[str]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        return str(user_id) if user_id else None
    except jwt.PyJWTError:
        return None


def _attach_request_user(request: Request) -> None:
    user_id = _decode_user_id_from_request(request)
    anonymized = anonymize_user_id(user_id)
    if anonymized:
        sentry_sdk.set_user({"id": anonymized})
    else:
        sentry_sdk.set_user(None)


def _clear_request_user() -> None:
    sentry_sdk.set_user(None)


def _should_report_api_status(status_code: int) -> bool:
    if status_code >= 500:
        return True
    if status_code in {401, 403, 404, 409, 422}:
        return False
    return status_code >= 400


def register_observability_handlers(app: FastAPI) -> None:
    logger = get_logger("memoryhub.api")

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        if errors:
            first = errors[0]
            loc = first.get("loc", ())
            field = loc[-1] if loc else "field"
            msg = first.get("msg", "Invalid input.")
            if field in {"body", "query", "path"}:
                message = "Invalid request."
            else:
                message = f"Invalid {field}: {msg}"
        else:
            message = "Invalid request."
        return JSONResponse(
            status_code=422,
            content={"detail": {"message": message}},
        )

    @app.middleware("http")
    async def observability_middleware(request: Request, call_next):
        _attach_request_user(request)
        try:
            response = await call_next(request)
            path = request.url.path
            status_code = response.status_code

            if status_code >= 500:
                logger.error(
                    "API error %s %s -> %s",
                    request.method,
                    path,
                    status_code,
                )
                if _should_report_api_status(status_code):
                    sentry_sdk.capture_message(
                        f"API {request.method} {path} returned {status_code}",
                        level="error",
                    )
            elif status_code >= 400 and _should_report_api_status(status_code):
                logger.warning(
                    "API client error %s %s -> %s",
                    request.method,
                    path,
                    status_code,
                )

            return response
        except Exception:
            logger.exception(
                "Unhandled error during %s %s",
                request.method,
                request.url.path,
            )
            sentry_sdk.capture_exception()
            raise
        finally:
            _clear_request_user()

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        if isinstance(exc, HTTPException):
            raise exc

        logger.exception(
            "Unhandled exception for %s %s",
            request.method,
            request.url.path,
        )
        sentry_sdk.capture_exception(exc)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": "Internal server error."}},
        )
