"""Commercial workflow API — validation, export preparation, structured exports."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user, get_db
from commercial_validation_models import CommercialValidationResult
from commercial_workflow_service import (
    export_invoice_workflow,
    invoice_lifecycle_view,
    prepare_invoice_for_export,
    validate_invoice_workflow,
)
from document_export.exceptions import (
    CommercialExportNotReadyError,
    CommercialExportWorkflowError,
)
from document_export.registry import list_export_formats
from invoices import INVOICE_PROJECTION, invoice_public

commercial_router = APIRouter(prefix="/commercial", tags=["commercial"])


class InvoiceLifecycleResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    invoice: dict
    lifecycle: dict


class InvoiceValidationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    validation: CommercialValidationResult
    invoice: dict
    lifecycle: dict


class ExportFormatsResponse(BaseModel):
    formats: list[str]


@commercial_router.get("/export-formats", response_model=ExportFormatsResponse)
async def read_export_formats():
    return ExportFormatsResponse(formats=list_export_formats())


@commercial_router.get("/invoices/{invoice_id}/lifecycle", response_model=InvoiceLifecycleResponse)
async def read_invoice_lifecycle(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await db.invoices.find_one(
        {"userId": current_user["id"], "id": invoice_id},
        INVOICE_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})
    public = invoice_public(doc)
    return InvoiceLifecycleResponse(
        invoice=public.model_dump(),
        lifecycle=invoice_lifecycle_view(doc),
    )


@commercial_router.post("/invoices/{invoice_id}/validate", response_model=InvoiceValidationResponse)
async def validate_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        validation, doc = await validate_invoice_workflow(db, current_user["id"], invoice_id)
    except ValueError:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})

    public = invoice_public(doc)
    return InvoiceValidationResponse(
        validation=validation,
        invoice=public.model_dump(),
        lifecycle=invoice_lifecycle_view(doc),
    )


@commercial_router.post("/invoices/{invoice_id}/prepare-export", response_model=InvoiceLifecycleResponse)
async def prepare_export(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        doc = await prepare_invoice_for_export(db, current_user["id"], invoice_id)
    except ValueError:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})
    except CommercialExportWorkflowError as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc)})

    public = invoice_public(doc)
    return InvoiceLifecycleResponse(
        invoice=public.model_dump(),
        lifecycle=invoice_lifecycle_view(doc),
    )


@commercial_router.post("/invoices/{invoice_id}/export")
async def export_invoice(
    invoice_id: str,
    format: str = Query("pdf", alias="format"),
    lang: Optional[str] = Query("fr"),
    requireReady: bool = Query(True, alias="requireReady"),
    pdpProvider: Optional[str] = Query(None, alias="pdpProvider"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        result, _doc = await export_invoice_workflow(
            db,
            current_user["id"],
            invoice_id,
            fmt=format,
            lang=lang if lang in ("fr", "en") else "fr",
            require_ready=requireReady,
            pdp_provider_key=pdpProvider,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail={"message": "Invoice not found."})
    except CommercialExportNotReadyError as exc:
        raise HTTPException(
            status_code=501,
            detail={"message": str(exc), "code": "export_not_implemented"},
        )
    except CommercialExportWorkflowError as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc)})

    return Response(
        content=result.data,
        media_type=result.contentType,
        headers={"Content-Disposition": f'attachment; filename="{result.filename}"'},
    )
