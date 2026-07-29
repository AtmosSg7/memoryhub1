"""Load commercial documents for export — avoids circular imports."""

from __future__ import annotations

from typing import Any, Dict, Tuple


async def load_commercial_document_public(
    db,
    *,
    user_id: str,
    document_type: str,
    document_id: str,
) -> Tuple[Dict[str, Any], dict]:
    if document_type == "quote":
        from quotes import QUOTE_PROJECTION, quote_public

        doc = await db.quotes.find_one(
            {"userId": user_id, "id": document_id},
            QUOTE_PROJECTION,
        )
        if not doc:
            raise ValueError("Quote not found.")
        return quote_public(doc).model_dump(), doc

    if document_type == "invoice":
        from invoices import INVOICE_PROJECTION, invoice_public

        doc = await db.invoices.find_one(
            {"userId": user_id, "id": document_id},
            INVOICE_PROJECTION,
        )
        if not doc:
            raise ValueError("Invoice not found.")
        return invoice_public(doc).model_dump(), doc

    raise ValueError(f"Unsupported document type: {document_type}")
