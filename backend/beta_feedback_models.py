"""Beta feedback models — short non-sensitive product feedback."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class BetaFeedbackCreate(BaseModel):
    intent: str = Field(..., min_length=1, max_length=500)
    blocker: str = Field(default="", max_length=500)
    suggestion: str = Field(default="", max_length=1000)
    page: Optional[str] = Field(default=None, max_length=200)
    website: str = Field(default="", max_length=200)
    formStartedAt: Optional[float] = None


class BetaFeedbackResponse(BaseModel):
    id: str
    message: str
