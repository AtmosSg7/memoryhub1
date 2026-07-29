from company_profile_service import get_default_vat_rate, resolve_import_vat_rate
from import_handlers.base import ImportEntityHandler
from import_models import CreatedEntities, NormalizedCommercialFields
from invoices import DEFAULT_STATUS, DEFAULT_TITLE, INPUT_STATUSES, insert_invoice_document


class InvoiceImportHandler(ImportEntityHandler):
    kind = "invoice"

    def duplicate_query(self, user_id: str, client_id: str, external_number: str) -> dict:
        return {
            "userId": user_id,
            "clientId": client_id,
            "externalNumber": external_number,
        }

    async def create_entity(
        self,
        db,
        user_id: str,
        *,
        client_id: str,
        client_name: str,
        fields: NormalizedCommercialFields,
        import_session_id: str,
        source_document_id: str,
    ) -> CreatedEntities:
        amount_ht = fields.amountHT or 0
        default_vat = await get_default_vat_rate(db, user_id)
        session = await db.import_sessions.find_one(
            {"userId": user_id, "id": import_session_id},
            {"_id": 0, "analysis.confidence.vatRate": 1},
        )
        vat_confidence = (
            (session or {}).get("analysis", {}).get("confidence", {}).get("vatRate")
            if session
            else None
        )
        vat_rate = resolve_import_vat_rate(fields.vatRate, vat_confidence, default_vat)
        status = fields.status if fields.status in INPUT_STATUSES else DEFAULT_STATUS

        doc = await insert_invoice_document(
            db,
            user_id,
            client_id=client_id,
            client_name=client_name,
            title=fields.title or DEFAULT_TITLE,
            amount_ht=amount_ht,
            vat_rate=vat_rate,
            invoice_date=fields.documentDate,
            status=status,
            internal_notes=fields.internalNotes,
            external_number=fields.externalNumber,
            source_document_id=source_document_id,
            import_session_id=import_session_id,
        )

        return CreatedEntities(
            clientId=client_id,
            invoiceId=doc["id"],
            documentId=source_document_id,
            entityType="invoice",
            entityId=doc["id"],
            entityNumber=doc["number"],
        )
