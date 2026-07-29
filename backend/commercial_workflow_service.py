"""Commercial invoice workflow — quote conversion, validation, export lifecycle."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from commercial_status import (
    DEFAULT_EXPORT_STATUS,
    can_transition_export_status,
    derive_lifecycle_status,
    normalize_export_status,
)
from commercial_validation_models import CommercialValidationResult
from commercial_validation_service import validate_invoice_for_user
from document_export.exceptions import (
    CommercialExportError,
    CommercialExportNotReadyError,
    CommercialExportWorkflowError,
)
from document_export.models import ExportFormat, ExportResult
from document_export.service import export_commercial_document
from events import record_event
from invoices import invoice_public


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def initialize_invoice_export_state(db, user_id: str, invoice_id: str) -> dict:
    """Set default export workflow fields on a newly created invoice."""
    now = _now_iso()
    await db.invoices.update_one(
        {"userId": user_id, "id": invoice_id},
        {
            "$set": {
                "exportStatus": DEFAULT_EXPORT_STATUS,
                "exportValidatedAt": None,
                "exportReadyAt": None,
                "exportExportedAt": None,
                "updatedAt": now,
            }
        },
    )
    doc = await db.invoices.find_one({"userId": user_id, "id": invoice_id}, {"_id": 0, "userId": 0})
    return doc


async def validate_invoice_workflow(
    db,
    user_id: str,
    invoice_id: str,
) -> tuple[CommercialValidationResult, dict]:
    doc = await db.invoices.find_one({"userId": user_id, "id": invoice_id}, {"_id": 0})
    if not doc:
        raise ValueError("Invoice not found.")

    result = await validate_invoice_for_user(db, user_id, doc)
    now = _now_iso()
    current = normalize_export_status(doc.get("exportStatus"))

    if result.valid:
        if can_transition_export_status(current, "validated"):
            await db.invoices.update_one(
                {"userId": user_id, "id": invoice_id},
                {
                    "$set": {
                        "exportStatus": "validated",
                        "exportValidatedAt": now,
                        "updatedAt": now,
                    }
                },
            )
    elif can_transition_export_status(current, "rejected"):
        await db.invoices.update_one(
            {"userId": user_id, "id": invoice_id},
            {
                "$set": {
                    "exportStatus": "rejected",
                    "updatedAt": now,
                }
            },
        )

    updated = await db.invoices.find_one(
        {"userId": user_id, "id": invoice_id},
        {"_id": 0, "userId": 0},
    )
    await record_event(
        db,
        user_id,
        "invoice_validated" if result.valid else "invoice_validation_failed",
        "invoice",
        invoice_id,
        client_id=doc.get("clientId"),
        metadata={
            "valid": result.valid,
            "errorCount": len(result.errors),
            "warningCount": len(result.warnings),
        },
    )
    return result, updated


async def prepare_invoice_for_export(db, user_id: str, invoice_id: str) -> dict:
    doc = await db.invoices.find_one({"userId": user_id, "id": invoice_id}, {"_id": 0})
    if not doc:
        raise ValueError("Invoice not found.")

    current = normalize_export_status(doc.get("exportStatus"))
    if current not in {"validated", "ready_for_export"}:
        validation, doc = await validate_invoice_workflow(db, user_id, invoice_id)
        if not validation.valid:
            raise CommercialExportWorkflowError(
                "Invoice failed validation and cannot be prepared for export."
            )
        current = normalize_export_status(doc.get("exportStatus"))

    if not can_transition_export_status(current, "ready_for_export"):
        raise CommercialExportWorkflowError(
            f"Cannot prepare export from status '{current}'."
        )

    now = _now_iso()
    await db.invoices.update_one(
        {"userId": user_id, "id": invoice_id},
        {
            "$set": {
                "exportStatus": "ready_for_export",
                "exportReadyAt": now,
                "updatedAt": now,
            }
        },
    )
    updated = await db.invoices.find_one(
        {"userId": user_id, "id": invoice_id},
        {"_id": 0, "userId": 0},
    )
    await record_event(
        db,
        user_id,
        "invoice_ready_for_export",
        "invoice",
        invoice_id,
        client_id=doc.get("clientId"),
    )
    return updated


async def export_invoice_workflow(
    db,
    user_id: str,
    invoice_id: str,
    *,
    fmt: ExportFormat | str = ExportFormat.PDF,
    lang: str = "fr",
    require_ready: bool = True,
    pdp_provider_key: Optional[str] = None,
) -> tuple[ExportResult, dict]:
    doc = await db.invoices.find_one({"userId": user_id, "id": invoice_id}, {"_id": 0})
    if not doc:
        raise ValueError("Invoice not found.")

    current = normalize_export_status(doc.get("exportStatus"))
    if require_ready and current != "ready_for_export":
        if current in {"draft", "validated", "rejected"}:
            raise CommercialExportWorkflowError(
                "Invoice must be validated and prepared before export. "
                "Use POST /commercial/invoices/{id}/prepare-export first."
            )
        if current == "exported" and str(fmt).lower() != ExportFormat.PDF.value:
            raise CommercialExportWorkflowError("Invoice has already been exported.")

    try:
        export_result = await export_commercial_document(
            db,
            user_id=user_id,
            document_type="invoice",
            document_id=invoice_id,
            fmt=fmt,
            lang=lang,
            pdp_provider_key=pdp_provider_key,
        )
    except CommercialExportNotReadyError:
        raise
    except CommercialExportError:
        raise

    if str(fmt).lower() in {ExportFormat.FACTURX.value, ExportFormat.PDP.value}:
        now = _now_iso()
        if can_transition_export_status(current, "exported"):
            await db.invoices.update_one(
                {"userId": user_id, "id": invoice_id},
                {
                    "$set": {
                        "exportStatus": "exported",
                        "exportExportedAt": now,
                        "updatedAt": now,
                    }
                },
            )
        await record_event(
            db,
            user_id,
            "invoice_exported",
            "invoice",
            invoice_id,
            client_id=doc.get("clientId"),
            metadata={"format": str(fmt), **export_result.metadata},
        )

    updated = await db.invoices.find_one(
        {"userId": user_id, "id": invoice_id},
        {"_id": 0, "userId": 0},
    )
    return export_result, updated


def invoice_lifecycle_view(doc: dict) -> dict:
    export_status = normalize_export_status(doc.get("exportStatus"))
    payment_status = doc.get("status") or "in_progress"
    return {
        "exportStatus": export_status,
        "paymentStatus": payment_status,
        "lifecycleStatus": derive_lifecycle_status(
            export_status=export_status,
            payment_status=payment_status,
        ),
        "exportValidatedAt": doc.get("exportValidatedAt"),
        "exportReadyAt": doc.get("exportReadyAt"),
        "exportExportedAt": doc.get("exportExportedAt"),
    }


async def run_post_conversion_workflow(db, user_id: str, invoice_id: str) -> dict:
    """After quote→invoice conversion: init export state and auto-validate."""
    await initialize_invoice_export_state(db, user_id, invoice_id)
    validation, doc = await validate_invoice_workflow(db, user_id, invoice_id)
    if validation.valid:
        doc = await prepare_invoice_for_export(db, user_id, invoice_id)
    return invoice_public(doc)
