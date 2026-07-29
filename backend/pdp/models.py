"""PDP payload and response models."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from document_export.models import ExportContext
from pdp.constants import PdpDispatchStatus, PdpEnvironment


class PdpCapabilities(BaseModel):
    """Feature flags exposed by a provider for orchestration and UI."""

    model_config = ConfigDict(extra="ignore")

    supports_cancellation: bool = True
    supports_status_sync: bool = True
    supports_webhooks: bool = False
    supports_credit_notes: bool = False
    supports_correction_invoices: bool = False


class PdpTransmissionErrorDetail(BaseModel):
    """Normalized transmission error returned by providers or the service layer."""

    model_config = ConfigDict(extra="ignore")

    code: str
    message: str
    retryable: bool = False
    raw: Optional[Dict[str, Any]] = None


class PdpInvoicePayload(BaseModel):
    """Normalized invoice payload for any PDP adapter."""

    model_config = ConfigDict(extra="ignore")

    invoiceId: str
    invoiceNumber: str
    userId: str
    clientId: str
    seller: Dict[str, Any] = Field(default_factory=dict)
    buyer: Dict[str, Any] = Field(default_factory=dict)
    invoiceDate: str
    amountHT: int
    vatRate: int
    amountTTC: int
    lineItems: Optional[List[Dict[str, Any]]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_export_context(cls, context: ExportContext) -> "PdpInvoicePayload":
        doc = context.document
        return cls(
            invoiceId=doc["id"],
            invoiceNumber=doc["number"],
            userId=context.userId,
            clientId=doc["clientId"],
            seller=context.seller or {},
            buyer=context.client or {},
            invoiceDate=doc.get("invoiceDate") or doc.get("quoteDate") or "",
            amountHT=int(doc.get("amountHT") or 0),
            vatRate=int(doc.get("vatRate") or 0),
            amountTTC=int(doc.get("amountTTC") or 0),
            lineItems=doc.get("lineItems"),
            metadata={"documentType": context.documentType},
        )


class PdpSendResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    externalId: str
    status: PdpDispatchStatus = "submitted"
    environment: Optional[PdpEnvironment] = None
    providerKey: Optional[str] = None
    error: Optional[PdpTransmissionErrorDetail] = None
    raw: Optional[Dict[str, Any]] = None


class PdpInvoiceStatus(BaseModel):
    model_config = ConfigDict(extra="ignore")

    externalId: str
    invoiceId: Optional[str] = None
    status: PdpDispatchStatus
    message: Optional[str] = None
    updatedAt: Optional[str] = None
    error: Optional[PdpTransmissionErrorDetail] = None


class PdpCancelResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    externalId: str
    cancelled: bool
    message: Optional[str] = None
    error: Optional[PdpTransmissionErrorDetail] = None


class PdpStatusSyncResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: List[PdpInvoiceStatus] = Field(default_factory=list)
    syncedAt: str
    providerKey: Optional[str] = None
    environment: Optional[PdpEnvironment] = None


class PdpDispatchRecord(BaseModel):
    """Future persistence shape for invoice PDP metadata (not stored in V1)."""

    model_config = ConfigDict(extra="ignore")

    invoiceId: str
    providerKey: str
    externalId: str
    status: PdpDispatchStatus
    environment: PdpEnvironment
    submittedAt: str
    lastSyncAt: Optional[str] = None
    lastError: Optional[PdpTransmissionErrorDetail] = None
