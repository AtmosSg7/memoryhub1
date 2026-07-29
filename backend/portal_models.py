from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from commercial_models import CommercialLineItem

QuoteStatus = Literal["sent", "accepted", "rejected", "expired"]
InvoiceStatus = Literal["in_progress", "paid", "overdue"]


class PortalCapabilities(BaseModel):
    quoteAcceptance: bool = True
    quoteRejection: bool = True
    onlinePayment: bool = False


class PortalQuoteDecisionRequest(BaseModel):
    signerName: str = Field(..., min_length=1, max_length=200)
    comment: Optional[str] = Field(None, max_length=2000)


class PortalClientPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    contactName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None


class PortalArtisanPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    companyName: str
    contactName: Optional[str] = None


class PortalQuotePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    number: str
    title: str
    status: QuoteStatus
    quoteDate: str
    amountHT: int
    vatRate: int
    amountTTC: int
    lineItems: Optional[List[CommercialLineItem]] = None
    invoiceNumber: Optional[str] = None
    canAccept: bool = False
    canReject: bool = False
    respondedAt: Optional[str] = None
    clientSignerName: Optional[str] = None
    clientComment: Optional[str] = None


class PortalQuoteAcceptResponse(BaseModel):
    quote: PortalQuotePublic


class PortalQuoteRejectResponse(BaseModel):
    quote: PortalQuotePublic


class PortalInvoicePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    number: str
    title: str
    status: InvoiceStatus
    invoiceDate: str
    amountHT: int
    vatRate: int
    amountTTC: int
    amountPaid: int = 0
    amountDue: int = 0
    isPaid: bool = False
    lineItems: Optional[List[CommercialLineItem]] = None
    quoteNumber: Optional[str] = None
    paidAt: Optional[str] = None


class PortalOverviewResponse(BaseModel):
    client: PortalClientPublic
    artisan: PortalArtisanPublic
    quotes: List[PortalQuotePublic] = Field(default_factory=list)
    invoices: List[PortalInvoicePublic] = Field(default_factory=list)
    capabilities: PortalCapabilities = Field(default_factory=PortalCapabilities)


class PortalAccessPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    clientId: str
    token: str
    portalUrl: str
    isActive: bool
    createdAt: str
    updatedAt: str
    lastAccessedAt: Optional[str] = None


class PortalShareEmailRequest(BaseModel):
    recipientEmail: Optional[str] = Field(None, max_length=254)
    lang: Literal["fr", "en"] = "fr"
    idempotencyKey: Optional[str] = Field(None, max_length=128)


class PortalShareEmailResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    emailStatus: str
    emailDelivered: bool
    emailEventId: str
    portalUrl: str
