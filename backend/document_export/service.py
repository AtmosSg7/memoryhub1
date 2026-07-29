"""Document export orchestration — builds context and delegates to exporters."""

from __future__ import annotations

from typing import Any, Dict, Optional

from commercial_document_loader import load_commercial_document_public
from document_export.models import ExportContext, ExportFormat, ExportResult
from document_export.registry import get_exporter


async def _load_seller(db, user_id: str) -> Optional[Dict[str, Any]]:
    from company_profile_service import get_seller_dict, get_user_with_profile

    user = await get_user_with_profile(db, user_id)
    return get_seller_dict(user, user.get("companyProfile"))


async def _load_client(db, user_id: str, client_id: str) -> Optional[Dict[str, Any]]:
    return await db.clients.find_one(
        {"userId": user_id, "id": client_id},
        {"_id": 0, "userId": 0},
    )


async def build_export_context(
    db,
    *,
    user_id: str,
    document_type: str,
    document_id: str,
    lang: str = "fr",
    strip_internal_notes: bool = False,
    pdp_provider_key: Optional[str] = None,
) -> ExportContext:
    public_data, _doc = await load_commercial_document_public(
        db,
        user_id=user_id,
        document_type=document_type,
        document_id=document_id,
    )

    client = await _load_client(db, user_id, public_data["clientId"])
    seller = await _load_seller(db, user_id)

    return ExportContext(
        userId=user_id,
        documentType=document_type,  # type: ignore[arg-type]
        documentId=document_id,
        lang=lang,
        document=public_data,
        client=client,
        seller=seller,
        stripInternalNotes=strip_internal_notes,
        pdpProviderKey=pdp_provider_key,
    )


class DocumentExportService:
    async def export(
        self,
        context: ExportContext,
        fmt: ExportFormat | str,
    ) -> ExportResult:
        exporter = get_exporter(fmt)
        if not exporter.supports(context.documentType):
            raise ValueError(
                f"Format {fmt} does not support document type {context.documentType}."
            )
        return await exporter.export(context)


async def export_commercial_document(
    db,
    *,
    user_id: str,
    document_type: str,
    document_id: str,
    fmt: ExportFormat | str,
    lang: str = "fr",
    strip_internal_notes: bool = False,
    pdp_provider_key: Optional[str] = None,
) -> ExportResult:
    context = await build_export_context(
        db,
        user_id=user_id,
        document_type=document_type,
        document_id=document_id,
        lang=lang,
        strip_internal_notes=strip_internal_notes,
        pdp_provider_key=pdp_provider_key,
    )
    service = DocumentExportService()
    return await service.export(context, fmt)
