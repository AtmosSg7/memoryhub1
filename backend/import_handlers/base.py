from abc import ABC, abstractmethod
from typing import Dict

from import_models import CreatedEntities, DocumentKind, NormalizedCommercialFields


class ImportEntityHandler(ABC):
    kind: DocumentKind

    @abstractmethod
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
        ...

    @abstractmethod
    def duplicate_query(
        self,
        user_id: str,
        client_id: str,
        external_number: str,
    ) -> dict:
        ...
