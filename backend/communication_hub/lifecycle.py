"""Lifecycle status helpers — independent from association status."""

from __future__ import annotations

from typing import Optional

from communication_hub.constants import (
    ASSOCIATION_IGNORED,
    LIFECYCLE_ARCHIVED,
    LIFECYCLE_IGNORED,
    LIFECYCLE_NEW,
    LIFECYCLE_READ,
    LIFECYCLE_REPLIED,
    LIFECYCLE_TO_READ,
    LIFECYCLE_TRANSITIONS,
    LIFECYCLE_WAITING,
)


def default_lifecycle_for_ingest(
    *,
    direction: Optional[str],
    association_status: Optional[str],
    existing_lifecycle: Optional[str] = None,
) -> str:
    """Pick initial / preserved lifecycle when a communication is upserted."""
    if existing_lifecycle and existing_lifecycle in LIFECYCLE_TRANSITIONS:
        # Preserve user-driven states across re-sync.
        if existing_lifecycle in {
            LIFECYCLE_READ,
            LIFECYCLE_REPLIED,
            LIFECYCLE_WAITING,
            LIFECYCLE_ARCHIVED,
            LIFECYCLE_IGNORED,
        }:
            return existing_lifecycle
    if association_status == ASSOCIATION_IGNORED:
        return LIFECYCLE_IGNORED
    if (direction or "").lower() == "inbound":
        return LIFECYCLE_TO_READ
    if (direction or "").lower() == "outbound":
        return LIFECYCLE_REPLIED
    return LIFECYCLE_NEW


def can_transition(current: str, target: str) -> bool:
    if current == target:
        return True
    allowed = LIFECYCLE_TRANSITIONS.get(current)
    if not allowed:
        return target in LIFECYCLE_TRANSITIONS
    return target in allowed


def available_actions_for(
    *,
    lifecycle: str,
    channel: str,
    association_status: Optional[str],
    has_client: bool,
) -> list[str]:
    """Channel-agnostic action hints for Hub UI (not Action Engine rules)."""
    actions: list[str] = []
    if lifecycle in {LIFECYCLE_NEW, LIFECYCLE_TO_READ}:
        actions.append("mark_read")
    if lifecycle not in {LIFECYCLE_ARCHIVED, LIFECYCLE_IGNORED}:
        actions.append("archive")
    if lifecycle != LIFECYCLE_IGNORED and association_status != ASSOCIATION_IGNORED:
        actions.append("ignore")
    if lifecycle == LIFECYCLE_IGNORED or association_status == ASSOCIATION_IGNORED:
        actions.append("restore")
    if not has_client and association_status != ASSOCIATION_IGNORED:
        actions.append("associate_client")
        actions.append("create_client")
    if has_client and channel in {"email", "whatsapp", "sms"}:
        actions.append("reply")
    if has_client and channel == "phone":
        actions.append("call_back")
    if lifecycle not in {LIFECYCLE_WAITING, LIFECYCLE_ARCHIVED}:
        actions.append("mark_waiting")
    return actions
