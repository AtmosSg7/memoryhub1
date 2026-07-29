"""Shared models for commercial document exporters."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ExportFormat(str, Enum):
    PDF = "pdf"
    FACTURX = "facturx"
    PDP = "pdp"


CommercialDocumentType = Literal["quote", "invoice"]


class ExportContext(BaseModel):
    """Normalized payload passed to every exporter implementation."""

    model_config = ConfigDict(extra="ignore")

    userId: str
    documentType: CommercialDocumentType
    documentId: str
    lang: str = "fr"
    document: Dict[str, Any]
    client: Optional[Dict[str, Any]] = None
    seller: Optional[Dict[str, Any]] = None
    stripInternalNotes: bool = False
    pdpProviderKey: Optional[str] = None


class ExportResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    format: ExportFormat
    contentType: str
    filename: str
    data: bytes
    metadata: Dict[str, Any] = Field(default_factory=dict)
