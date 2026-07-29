from company_profile_service import get_default_vat_rate, resolve_import_vat_rate
from import_handlers.base import ImportEntityHandler
from import_models import CreatedEntities, NormalizedCommercialFields
from quotes import DEFAULT_TITLE as QUOTE_DEFAULT_TITLE, VALID_STATUSES, insert_quote_document


class QuoteImportHandler(ImportEntityHandler):
    kind = "quote"

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
        status = fields.status if fields.status in VALID_STATUSES else "draft"

        doc = await insert_quote_document(
            db,
            user_id,
            client_id=client_id,
            client_name=client_name,
            title=fields.title or QUOTE_DEFAULT_TITLE,
            amount_ht=amount_ht,
            vat_rate=vat_rate,
            quote_date=fields.documentDate,
            status=status,
            internal_notes=fields.internalNotes,
            external_number=fields.externalNumber,
            source_document_id=source_document_id,
            import_session_id=import_session_id,
        )

        return CreatedEntities(
            clientId=client_id,
            quoteId=doc["id"],
            documentId=source_document_id,
            entityType="quote",
            entityId=doc["id"],
            entityNumber=doc["number"],
        )
