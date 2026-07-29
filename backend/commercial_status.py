"""Commercial document lifecycle statuses — payment vs export workflow."""

from __future__ import annotations

from typing import Literal, Optional, Set

# Export readiness workflow (e-invoicing / Factur-X / PDP preparation).
CommercialExportStatus = Literal[
    "draft",
    "validated",
    "ready_for_export",
    "exported",
    "rejected",
]

# Unified lifecycle view for UI and future PDP sync (derived, not stored alone).
CommercialLifecycleStatus = Literal[
    "draft",
    "validated",
    "ready_for_export",
    "exported",
    "rejected",
    "paid",
    "cancelled",
]

DEFAULT_EXPORT_STATUS: CommercialExportStatus = "draft"

VALID_EXPORT_STATUSES: Set[str] = {
    "draft",
    "validated",
    "ready_for_export",
    "exported",
    "rejected",
}

EXPORT_STATUS_TRANSITIONS: dict[str, Set[str]] = {
    "draft": {"validated", "rejected"},
    "validated": {"ready_for_export", "rejected", "draft"},
    "ready_for_export": {"exported", "rejected", "validated"},
    "exported": set(),
    "rejected": {"draft"},
}


def normalize_export_status(value: Optional[str]) -> CommercialExportStatus:
    if value in VALID_EXPORT_STATUSES:
        return value  # type: ignore[return-value]
    return DEFAULT_EXPORT_STATUS


def can_transition_export_status(
    current: CommercialExportStatus,
    target: CommercialExportStatus,
) -> bool:
    if current == target:
        return True
    return target in EXPORT_STATUS_TRANSITIONS.get(current, set())


def derive_lifecycle_status(
    *,
    export_status: CommercialExportStatus,
    payment_status: str,
) -> CommercialLifecycleStatus:
    """Map stored export + payment statuses to a single lifecycle label."""
    if payment_status == "cancelled":
        return "cancelled"
    if payment_status == "paid":
        return "paid"
    if export_status in VALID_EXPORT_STATUSES:
        return export_status  # type: ignore[return-value]
    return "draft"
