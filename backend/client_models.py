"""Client domain models — Client-centric MemoryHub core.

Backward-compatible design:
- Flat scalars (`email`, `phone`, `address`, `city`, …) remain the public contract
  used by existing UI, imports, portal, and e-invoicing.
- Nested collections (`emails`, `phones`, `addresses`) are additive and hydrated
  from flat fields when missing (lazy dual-read).
- Writes sync primary nested entries ↔ flat scalars (dual-write).
- Each nested contact carries generic sync metadata (source, status, version…)
  for future connectors — no external sync is productized yet.

Future-ready (declared, not fully productized yet):
- tags, isFavorite, photo, companyInfo, integrations stubs.
- contact sync metadata consumed by future connectors.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from contact_sync import ContactSource, ContactSyncStatus

ClientStatus = Literal["active", "pending", "new", "dormant"]

# v3 = nested contacts carry sync metadata (still dual-reads v1 flat scalars)
CLIENT_SCHEMA_VERSION = 3

ContactLabel = Optional[str]


class ContactSyncFields(BaseModel):
    """Shared sync provenance for emails / phones / addresses."""

    model_config = ConfigDict(extra="ignore")

    source: ContactSource = "manual"
    sourceId: Optional[str] = Field(None, max_length=200)
    syncStatus: ContactSyncStatus = "synced"
    lastSyncedAt: Optional[str] = None
    createdBy: Optional[str] = Field(None, max_length=200)
    updatedBy: Optional[str] = Field(None, max_length=200)
    isUserModified: bool = False
    version: int = Field(1, ge=1)


class ClientEmail(ContactSyncFields):
    model_config = ConfigDict(extra="ignore")

    id: str
    value: str = Field(..., min_length=1, max_length=254)
    label: ContactLabel = Field(None, max_length=40)
    isPrimary: bool = False


class ClientPhone(ContactSyncFields):
    model_config = ConfigDict(extra="ignore")

    id: str
    value: str = Field(..., min_length=1, max_length=50)
    label: ContactLabel = Field(None, max_length=40)
    isPrimary: bool = False


class ClientAddress(ContactSyncFields):
    model_config = ConfigDict(extra="ignore")

    id: str
    line1: Optional[str] = Field(None, max_length=500)
    line2: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=200)
    postalCode: Optional[str] = Field(None, max_length=20)
    country: str = Field("FR", max_length=2)
    label: ContactLabel = Field(None, max_length=40)
    isPrimary: bool = False


class ClientCompanyInfo(BaseModel):
    """Structured company block (mirrors flat company/siret/vat/activity)."""

    model_config = ConfigDict(extra="ignore")

    legalName: Optional[str] = Field(None, max_length=200)
    tradeName: Optional[str] = Field(None, max_length=200)
    siret: Optional[str] = Field(None, max_length=14)
    vatNumber: Optional[str] = Field(None, max_length=32)
    activity: Optional[str] = Field(None, max_length=200)


class ClientIntegrations(BaseModel):
    """Reserved hooks for future external sync — empty by default."""

    model_config = ConfigDict(extra="ignore")

    googleContactsId: Optional[str] = None
    gmailThreadHint: Optional[str] = None
    whatsappNumber: Optional[str] = None
    calendarLink: Optional[str] = None


class ClientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    contactName: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=200)
    activity: Optional[str] = Field(None, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=200)
    postalCode: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=2)
    siret: Optional[str] = Field(None, max_length=14)
    vatNumber: Optional[str] = Field(None, max_length=32)
    status: ClientStatus = "new"
    notes: Optional[str] = Field(None, max_length=5000)
    tags: Optional[List[str]] = Field(None, max_length=40)
    isFavorite: bool = False
    emails: Optional[List[ClientEmail]] = None
    phones: Optional[List[ClientPhone]] = None
    addresses: Optional[List[ClientAddress]] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be empty.")
        return stripped

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        cleaned: List[str] = []
        seen = set()
        for raw in value:
            tag = (raw or "").strip().lower()[:40]
            if tag and tag not in seen:
                seen.add(tag)
                cleaned.append(tag)
        return cleaned[:40]


class ClientUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    contactName: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=200)
    activity: Optional[str] = Field(None, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=200)
    postalCode: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=2)
    siret: Optional[str] = Field(None, max_length=14)
    vatNumber: Optional[str] = Field(None, max_length=32)
    status: Optional[ClientStatus] = None
    notes: Optional[str] = Field(None, max_length=5000)
    tags: Optional[List[str]] = Field(None, max_length=40)
    isFavorite: Optional[bool] = None
    photoStorageKey: Optional[str] = Field(None, max_length=500)
    emails: Optional[List[ClientEmail]] = None
    phones: Optional[List[ClientPhone]] = None
    addresses: Optional[List[ClientAddress]] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be empty.")
        return stripped

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        cleaned: List[str] = []
        seen = set()
        for raw in value:
            tag = (raw or "").strip().lower()[:40]
            if tag and tag not in seen:
                seen.add(tag)
                cleaned.append(tag)
        return cleaned[:40]


class ClientPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    contactName: Optional[str] = None
    # Flat scalars — legacy + primary shortcuts
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    activity: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postalCode: Optional[str] = None
    country: Optional[str] = None
    siret: Optional[str] = None
    vatNumber: Optional[str] = None
    status: ClientStatus = "new"
    notes: Optional[str] = None
    # Extended Client-centric fields
    tags: List[str] = Field(default_factory=list)
    isFavorite: bool = False
    photoStorageKey: Optional[str] = None
    emails: List[ClientEmail] = Field(default_factory=list)
    phones: List[ClientPhone] = Field(default_factory=list)
    addresses: List[ClientAddress] = Field(default_factory=list)
    companyInfo: Optional[ClientCompanyInfo] = None
    integrations: ClientIntegrations = Field(default_factory=ClientIntegrations)
    schemaVersion: int = CLIENT_SCHEMA_VERSION
    createdAt: str
    updatedAt: str
    # List enrichment (populated on GET /clients; defaults keep single-item responses compatible)
    totalRevenue: int = 0
    documentsCount: int = 0
    notesCount: int = 0
    lastActivityAt: Optional[str] = None


class ClientListResponse(BaseModel):
    items: List[ClientPublic]
    total: int
