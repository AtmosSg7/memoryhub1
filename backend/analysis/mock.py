import hashlib
import re
from datetime import datetime, timezone

from analysis.base import AnalysisContext, DocumentAnalyzer
from import_models import AnalysisResultData, NormalizedCommercialFields, utc_now_iso

_MOCK_SAMPLES = [
    {
        "detectedKind": "quote",
        "title": "Devis rénovation salle de bain",
        "clientName": "Martin Dupont",
        "company": "Dupont Rénovation",
        "email": "martin.dupont@example.fr",
        "phone": "06 12 34 56 78",
        "address": "12 rue des Artisans",
        "city": "Lyon",
        "externalNumber": "DEV-EXT-2026-0142",
        "amountHT": 245000,
        "vatRate": 20,
        "amountTTC": 294000,
        "internalNotes": "Fourniture et pose carrelage.",
    },
    {
        "detectedKind": "invoice",
        "title": "Facture travaux électricité",
        "clientName": "Sophie Bernard",
        "company": "Bernard & Fils",
        "email": "contact@bernard-fils.fr",
        "phone": "04 78 00 11 22",
        "address": "8 avenue Victor Hugo",
        "city": "Villeurbanne",
        "externalNumber": "FAC-EXT-2026-0088",
        "amountHT": 89000,
        "vatRate": 20,
        "amountTTC": 106800,
        "internalNotes": "Mise aux normes tableau électrique.",
    },
]


class MockAnalyzer(DocumentAnalyzer):
    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def provider_version(self) -> str:
        return "1.0.0"

    async def analyze(self, content: bytes, context: AnalysisContext) -> AnalysisResultData:
        digest = hashlib.sha256(content).hexdigest()
        index = int(digest[:8], 16) % len(_MOCK_SAMPLES)
        sample = _MOCK_SAMPLES[index]

        filename_lower = context.filename.lower()
        detected_kind = sample["detectedKind"]
        if "facture" in filename_lower or "invoice" in filename_lower:
            detected_kind = "invoice"
        elif "devis" in filename_lower or "quote" in filename_lower:
            detected_kind = "quote"

        now = utc_now_iso()
        document_date = datetime.now(timezone.utc).replace(
            hour=12, minute=0, second=0, microsecond=0
        ).isoformat()

        normalized = NormalizedCommercialFields(
            clientName=sample["clientName"],
            company=sample["company"],
            contactName=sample["clientName"],
            email=sample["email"],
            phone=sample["phone"],
            address=sample["address"],
            city=sample["city"],
            externalNumber=sample["externalNumber"],
            documentDate=document_date,
            title=sample["title"],
            amountHT=sample["amountHT"],
            vatRate=sample["vatRate"],
            amountTTC=sample["amountTTC"],
            internalNotes=sample["internalNotes"],
            status="draft" if detected_kind == "quote" else "sent",
        )

        raw = {
            "provider": self.provider_name,
            "providerVersion": self.provider_version,
            "filename": context.filename,
            "contentSha256": digest,
            "pages": 1,
            "language": "fr",
            "blocks": [
                {"type": "header", "text": sample["company"]},
                {"type": "field", "label": "Numéro", "text": sample["externalNumber"]},
                {"type": "field", "label": "Montant HT", "text": str(sample["amountHT"] / 100)},
            ],
            "detectedKind": detected_kind,
        }

        confidence = {
            "clientName": 0.92,
            "company": 0.88,
            "email": 0.95,
            "phone": 0.84,
            "externalNumber": 0.9,
            "documentDate": 0.78,
            "amountHT": 0.91,
            "vatRate": 0.85,
            "amountTTC": 0.89,
            "title": 0.8,
        }

        warnings = []
        if not re.search(r"@.", sample["email"] or ""):
            warnings.append("Email format uncertain.")

        return AnalysisResultData(
            rawExtracted=raw,
            normalized=normalized,
            confidence=confidence,
            overallConfidence=0.87,
            provider=self.provider_name,
            providerVersion=self.provider_version,
            analyzedAt=now,
            detectedKind=detected_kind,
            detectedKindConfidence=0.91 if detected_kind == sample["detectedKind"] else 0.82,
            errors=[],
            warnings=warnings,
        )
