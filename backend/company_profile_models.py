"""Company profile API models."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CompanyProfilePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    legalName: str = ""
    tradeName: Optional[str] = None
    siret: Optional[str] = None
    vatNumber: Optional[str] = None
    address: Optional[str] = None
    postalCode: Optional[str] = None
    city: Optional[str] = None
    country: str = "FR"
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

    iban: Optional[str] = None
    bic: Optional[str] = None
    bankName: Optional[str] = None

    paymentTerms: Optional[str] = None
    paymentDelayDays: int = 30
    latePenaltyRate: Optional[str] = None
    flatRecoveryIndemnity: Optional[str] = None
    defaultVatRate: int = 20
    currency: str = "EUR"
    quotePrefix: str = "DEV"
    invoicePrefix: str = "FAC"

    logoStorageKey: Optional[str] = None
    pdfLogoStorageKey: Optional[str] = None
    primaryColor: str = "#0A2540"
    emailSignature: Optional[str] = None

    updatedAt: Optional[str] = None


class CompanyProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    legalName: Optional[str] = Field(None, max_length=200)
    tradeName: Optional[str] = Field(None, max_length=200)
    siret: Optional[str] = Field(None, max_length=20)
    vatNumber: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=300)
    postalCode: Optional[str] = Field(None, max_length=20)
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=2)
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=200)
    website: Optional[str] = Field(None, max_length=300)

    iban: Optional[str] = Field(None, max_length=40)
    bic: Optional[str] = Field(None, max_length=20)
    bankName: Optional[str] = Field(None, max_length=200)

    paymentTerms: Optional[str] = Field(None, max_length=500)
    paymentDelayDays: Optional[int] = Field(None, ge=0, le=365)
    latePenaltyRate: Optional[str] = Field(None, max_length=200)
    flatRecoveryIndemnity: Optional[str] = Field(None, max_length=200)
    defaultVatRate: Optional[int] = Field(None, ge=0, le=100)
    currency: Optional[str] = Field(None, max_length=3)
    quotePrefix: Optional[str] = Field(None, max_length=10)
    invoicePrefix: Optional[str] = Field(None, max_length=10)

    pdfLogoStorageKey: Optional[str] = Field(None, max_length=500)
    primaryColor: Optional[str] = Field(None, max_length=7)
    emailSignature: Optional[str] = Field(None, max_length=2000)


class CompanyProfileResponse(BaseModel):
    profile: CompanyProfilePublic
    logoUrl: Optional[str] = None
    pdfLogoUrl: Optional[str] = None
