from import_handlers.base import ImportEntityHandler
from import_handlers.invoice import InvoiceImportHandler
from import_handlers.quote import QuoteImportHandler
from import_models import DocumentKind

_HANDLERS: dict[DocumentKind, ImportEntityHandler] = {
    "quote": QuoteImportHandler(),
    "invoice": InvoiceImportHandler(),
}

SUPPORTED_CONFIRM_KINDS = frozenset(_HANDLERS.keys())


def get_import_handler(kind: DocumentKind) -> ImportEntityHandler:
    handler = _HANDLERS.get(kind)
    if not handler:
        raise KeyError(kind)
    return handler


def is_confirm_kind_supported(kind: DocumentKind) -> bool:
    return kind in SUPPORTED_CONFIRM_KINDS
