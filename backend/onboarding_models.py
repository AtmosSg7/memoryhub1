"""Pydantic models for onboarding, checklist and account maturity."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

AccountMaturity = Literal["empty", "starting", "active"]


class OnboardingWizardState(BaseModel):
    completed: bool = False
    dismissed: bool = False
    currentStep: int = Field(default=0, ge=0, le=4)
    completedAt: Optional[str] = None


class ChecklistItemPublic(BaseModel):
    id: str
    done: bool
    labelKey: str
    link: Optional[str] = None


class ChecklistStatePublic(BaseModel):
    dismissed: bool = False
    visible: bool = False
    completed: bool = False
    items: List[ChecklistItemPublic] = Field(default_factory=list)
    doneCount: int = 0
    totalCount: int = 0


class FirstWinPublic(BaseModel):
    id: str
    achieved: bool
    celebratedAt: Optional[str] = None


class AccountSignals(BaseModel):
    clientsCount: int = 0
    documentsCount: int = 0
    quotesCount: int = 0
    invoicesCount: int = 0
    notesCount: int = 0
    communicationsCount: int = 0
    gmailConnected: bool = False
    googleContactsConnected: bool = False
    recentActivityDays: Optional[int] = None


class AccountMaturityPublic(BaseModel):
    maturity: AccountMaturity
    signals: AccountSignals
    demoAllowed: bool = False


class OnboardingStatePublic(BaseModel):
    maturity: AccountMaturity
    signals: AccountSignals
    demoAllowed: bool = False
    wizard: OnboardingWizardState
    checklist: ChecklistStatePublic
    firstWins: List[FirstWinPublic] = Field(default_factory=list)
    showWizard: bool = False
    showChecklist: bool = False


class WizardUpdateBody(BaseModel):
    completed: Optional[bool] = None
    dismissed: Optional[bool] = None
    currentStep: Optional[int] = Field(default=None, ge=0, le=4)


class ChecklistUpdateBody(BaseModel):
    dismissed: Optional[bool] = None


class FirstWinAckBody(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
