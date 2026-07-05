from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

DEFAULT_COMMERCIAL_VAT_RATE = 20
MAX_COMMERCIAL_LINES = 50


class CommercialLineItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    description: str = Field(..., min_length=1, max_length=500)
    quantity: float = Field(default=1.0, gt=0)
    unitPriceHT: int = Field(..., ge=0)
    vatRate: int = Field(default=DEFAULT_COMMERCIAL_VAT_RATE, ge=0, le=100)
    amountHT: int = Field(..., ge=0)
    discount: Optional[str] = Field(default=None, max_length=100)


class CommercialDocumentTotals(BaseModel):
    amountHT: int = Field(..., ge=0)
    vatRate: int = Field(..., ge=0, le=100)
    amountTTC: int = Field(..., ge=0)


class CommercialDocumentAmounts(BaseModel):
    lineItems: Optional[List[CommercialLineItem]] = None
    totals: CommercialDocumentTotals
