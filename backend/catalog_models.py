from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

DEFAULT_CATALOG_SOURCE = "learned"


class CatalogItemPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    description: str
    usageCount: int = Field(..., ge=0)
    lastUsedAt: str
    unitPriceHTMin: int = Field(..., ge=0)
    unitPriceHTMax: int = Field(..., ge=0)
    unitPriceHTAvg: int = Field(..., ge=0)
    defaultVatRate: int = Field(..., ge=0, le=100)
    source: str = DEFAULT_CATALOG_SOURCE
    createdAt: str
    updatedAt: str


class CatalogListResponse(BaseModel):
    items: List[CatalogItemPublic]
    total: int


class CatalogStatsResponse(BaseModel):
    totalItems: int
    totalUsages: int
    averageUsagePerItem: float
    mostUsed: List[CatalogItemPublic]
