"""Models for commercial document validation (e-invoicing readiness)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


ValidationSeverity = Literal["error", "warning"]


class CommercialValidationIssue(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str
    message: str
    severity: ValidationSeverity = "error"
    field: Optional[str] = None


class CommercialValidationResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    valid: bool
    errors: List[CommercialValidationIssue] = Field(default_factory=list)
    warnings: List[CommercialValidationIssue] = Field(default_factory=list)
