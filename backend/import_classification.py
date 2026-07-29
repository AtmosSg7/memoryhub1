"""Extensible document type registry for the import engine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, FrozenSet, List, Optional

from import_models import DocumentKind


@dataclass(frozen=True)
class DocumentTypeDefinition:
    key: DocumentKind
    label_fr: str
    label_en: str
    confirmable: bool
    aliases: FrozenSet[str]


def _def(
    key: DocumentKind,
    label_fr: str,
    label_en: str,
    *,
    confirmable: bool = False,
    aliases: Optional[FrozenSet[str]] = None,
) -> DocumentTypeDefinition:
    return DocumentTypeDefinition(
        key=key,
        label_fr=label_fr,
        label_en=label_en,
        confirmable=confirmable,
        aliases=aliases or frozenset(),
    )


DOCUMENT_TYPE_REGISTRY: Dict[DocumentKind, DocumentTypeDefinition] = {
    "quote": _def(
        "quote",
        "Devis",
        "Quote",
        confirmable=True,
        aliases=frozenset({"devis", "proposition", "estimation"}),
    ),
    "invoice": _def(
        "invoice",
        "Facture",
        "Invoice",
        confirmable=True,
        aliases=frozenset({"facture", "facture client"}),
    ),
    "supplier_invoice": _def(
        "supplier_invoice",
        "Facture fournisseur",
        "Supplier invoice",
        aliases=frozenset({"facture fournisseur", "facture achat", "facture achats"}),
    ),
    "delivery_note": _def(
        "delivery_note",
        "Bon de livraison",
        "Delivery note",
        aliases=frozenset({"bon de livraison", "bl", "livraison"}),
    ),
    "receipt": _def(
        "receipt",
        "Ticket",
        "Receipt",
        aliases=frozenset({"ticket", "recu", "reçu", "ticket de caisse"}),
    ),
    "purchase_order": _def(
        "purchase_order",
        "Bon de commande",
        "Purchase order",
        aliases=frozenset({"bon de commande", "commande"}),
    ),
    "administrative_document": _def(
        "administrative_document",
        "Document administratif",
        "Administrative document",
        aliases=frozenset(
            {
                "document administratif",
                "attestation",
                "certificat",
                "declaration",
                "déclaration",
            }
        ),
    ),
    "contract": _def(
        "contract",
        "Contrat",
        "Contract",
        aliases=frozenset({"contrat", "convention"}),
    ),
    "other": _def("other", "Autre", "Other", aliases=frozenset({"autre", "inconnu"})),
}


def list_document_types() -> List[DocumentTypeDefinition]:
    return list(DOCUMENT_TYPE_REGISTRY.values())


def get_document_type(key: DocumentKind) -> DocumentTypeDefinition:
    return DOCUMENT_TYPE_REGISTRY.get(key, DOCUMENT_TYPE_REGISTRY["other"])


def is_confirmable_kind(key: DocumentKind) -> bool:
    return get_document_type(key).confirmable


def normalize_detected_kind(value: Optional[str]) -> DocumentKind:
    if not value:
        return "other"
    raw = str(value).strip().lower()
    if raw in DOCUMENT_TYPE_REGISTRY:
        return raw
    for definition in DOCUMENT_TYPE_REGISTRY.values():
        if raw == definition.key or raw in definition.aliases:
            return definition.key
    return "other"
