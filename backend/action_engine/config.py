"""Configurable Action Engine switches (env, no secrets)."""

from __future__ import annotations

import os

from action_engine.constants import (
    ACTION_TYPE_CALL_BACK,
    ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE,
    ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE,
    ACTION_TYPE_READ_CLIENT_REPLY,
    ACTION_TYPE_REPLY_TO_PROSPECT,
)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def action_engine_enabled() -> bool:
    return _env_bool("ACTION_ENGINE_ENABLED", True)


_RULE_ENV = {
    ACTION_TYPE_REPLY_TO_PROSPECT: "ACTION_RULE_REPLY_TO_PROSPECT",
    ACTION_TYPE_READ_CLIENT_REPLY: "ACTION_RULE_READ_CLIENT_REPLY",
    ACTION_TYPE_CALL_BACK: "ACTION_RULE_CALL_BACK",
    ACTION_TYPE_FOLLOW_UP_OVERDUE_INVOICE: "ACTION_RULE_FOLLOW_UP_OVERDUE_INVOICE",
    ACTION_TYPE_CREATE_INVOICE_FROM_QUOTE: "ACTION_RULE_CREATE_INVOICE_FROM_QUOTE",
}


def rule_enabled(action_type: str) -> bool:
    if not action_engine_enabled():
        return False
    env_name = _RULE_ENV.get(action_type)
    if not env_name:
        return False
    return _env_bool(env_name, True)
