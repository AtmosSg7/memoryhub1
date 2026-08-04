"""Account maturity, onboarding wizard and startup checklist."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import HTTPException
from security_config import IS_DEPLOYED

from integrations.constants import (
    ACCOUNT_STATUS_CONNECTED,
    PROVIDER_GMAIL,
    PROVIDER_GOOGLE_CONTACTS,
)
from onboarding_models import (
    AccountMaturity,
    AccountMaturityPublic,
    AccountSignals,
    ChecklistItemPublic,
    ChecklistStatePublic,
    FirstWinPublic,
    OnboardingStatePublic,
    OnboardingWizardState,
)

CHECKLIST_ITEMS = (
    ("create_client", "checklist.createClient", "/dashboard/clients"),
    ("add_note_or_document", "checklist.importCommercialDoc", "/dashboard/documents?import=1"),
    ("connect_google_contacts", "checklist.connectContacts", "/dashboard/integrations"),
    ("connect_gmail", "checklist.connectGmail", "/dashboard/integrations"),
    ("view_client_360", "checklist.viewClient360", "/dashboard/clients"),
)

FIRST_WIN_IDS = (
    "first_client",
    "first_document",
    "first_google",
    "first_email_linked",
    "first_note",
)

ACTIVE_CLIENT_THRESHOLD = 3
ACTIVE_SIGNAL_THRESHOLD = 2


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _onboarding_doc(user: dict) -> dict:
    raw = user.get("onboarding")
    return raw if isinstance(raw, dict) else {}


async def _count(db, collection: str, user_id: str) -> int:
    return int(await db[collection].count_documents({"userId": user_id}))


async def _connected(db, user_id: str, provider: str) -> bool:
    doc = await db.connected_accounts.find_one(
        {"userId": user_id, "provider": provider, "status": ACCOUNT_STATUS_CONNECTED},
        {"_id": 1},
    )
    return doc is not None


async def collect_signals(db, user_id: str) -> AccountSignals:
    clients = await _count(db, "clients", user_id)
    documents = await _count(db, "documents", user_id)
    quotes = await _count(db, "quotes", user_id)
    invoices = await _count(db, "invoices", user_id)
    notes = await _count(db, "notes", user_id)
    communications = await _count(db, "communications", user_id)
    gmail = await _connected(db, user_id, PROVIDER_GMAIL)
    contacts = await _connected(db, user_id, PROVIDER_GOOGLE_CONTACTS)

    recent_days: Optional[int] = None
    latest = await db.events.find_one(
        {"userId": user_id},
        {"_id": 0, "createdAt": 1},
        sort=[("createdAt", -1)],
    )
    if latest and latest.get("createdAt"):
        try:
            raw = latest["createdAt"]
            if isinstance(raw, str):
                created = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            else:
                created = raw
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            recent_days = max(0, int((datetime.now(timezone.utc) - created).total_seconds() // 86400))
        except (TypeError, ValueError):
            recent_days = None

    return AccountSignals(
        clientsCount=clients,
        documentsCount=documents,
        quotesCount=quotes,
        invoicesCount=invoices,
        notesCount=notes,
        communicationsCount=communications,
        gmailConnected=gmail,
        googleContactsConnected=contacts,
        recentActivityDays=recent_days,
    )


def compute_maturity(signals: AccountSignals) -> AccountMaturity:
    has_any = (
        signals.clientsCount > 0
        or signals.documentsCount > 0
        or signals.quotesCount > 0
        or signals.invoicesCount > 0
        or signals.notesCount > 0
        or signals.communicationsCount > 0
    )
    if not has_any:
        return "empty"

    active_signals = 0
    if signals.clientsCount >= ACTIVE_CLIENT_THRESHOLD:
        active_signals += 2
    elif signals.clientsCount > 0:
        active_signals += 1
    if signals.documentsCount > 0 or signals.quotesCount > 0 or signals.invoicesCount > 0:
        active_signals += 1
    if signals.communicationsCount > 0 or signals.gmailConnected:
        active_signals += 1
    if signals.notesCount > 0:
        active_signals += 1
    if signals.googleContactsConnected:
        active_signals += 1
    if signals.recentActivityDays is not None and signals.recentActivityDays <= 14:
        active_signals += 1

    if active_signals >= ACTIVE_SIGNAL_THRESHOLD and (
        signals.clientsCount >= ACTIVE_CLIENT_THRESHOLD
        or (signals.clientsCount > 0 and (signals.quotesCount + signals.invoicesCount) > 0)
        or (signals.clientsCount > 0 and signals.communicationsCount > 0)
    ):
        return "active"

    return "starting"


def demo_allowed() -> bool:
    return not IS_DEPLOYED


def _checklist_done_flags(signals: AccountSignals, onboarding: dict) -> Dict[str, bool]:
    viewed_360 = bool(onboarding.get("viewedClient360"))
    return {
        "create_client": signals.clientsCount > 0,
        "add_note_or_document": signals.notesCount > 0 or signals.documentsCount > 0,
        "connect_google_contacts": signals.googleContactsConnected,
        "connect_gmail": signals.gmailConnected,
        "view_client_360": viewed_360 and signals.clientsCount > 0,
    }


def build_checklist(signals: AccountSignals, onboarding: dict, maturity: AccountMaturity) -> ChecklistStatePublic:
    dismissed = bool(onboarding.get("checklistDismissed"))
    flags = _checklist_done_flags(signals, onboarding)
    items = [
        ChecklistItemPublic(id=item_id, done=flags[item_id], labelKey=label_key, link=link)
        for item_id, label_key, link in CHECKLIST_ITEMS
    ]
    done_count = sum(1 for item in items if item.done)
    total = len(items)
    completed = done_count >= total
    # Hide for active accounts, dismissed, or fully completed
    visible = (
        not dismissed
        and not completed
        and maturity in {"empty", "starting"}
    )
    return ChecklistStatePublic(
        dismissed=dismissed,
        visible=visible,
        completed=completed,
        items=items,
        doneCount=done_count,
        totalCount=total,
    )


def _wizard_state(onboarding: dict) -> OnboardingWizardState:
    return OnboardingWizardState(
        completed=bool(onboarding.get("wizardCompleted")),
        dismissed=bool(onboarding.get("wizardDismissed")),
        currentStep=int(onboarding.get("wizardStep") or 0),
        completedAt=onboarding.get("wizardCompletedAt"),
    )


def _first_wins(signals: AccountSignals, onboarding: dict) -> List[FirstWinPublic]:
    celebrated = onboarding.get("firstWinsCelebrated") or {}
    if not isinstance(celebrated, dict):
        celebrated = {}

    achieved = {
        "first_client": signals.clientsCount > 0,
        "first_document": signals.documentsCount > 0,
        "first_google": signals.gmailConnected or signals.googleContactsConnected,
        "first_email_linked": signals.communicationsCount > 0,
        "first_note": signals.notesCount > 0,
    }
    return [
        FirstWinPublic(
            id=win_id,
            achieved=achieved[win_id],
            celebratedAt=celebrated.get(win_id),
        )
        for win_id in FIRST_WIN_IDS
    ]


def should_show_wizard(wizard: OnboardingWizardState, maturity: AccountMaturity) -> bool:
    if wizard.completed or wizard.dismissed:
        return False
    return maturity == "empty"


async def get_onboarding_state(db, user: dict) -> OnboardingStatePublic:
    user_id = user["id"]
    signals = await collect_signals(db, user_id)
    maturity = compute_maturity(signals)
    onboarding = _onboarding_doc(user)
    wizard = _wizard_state(onboarding)
    checklist = build_checklist(signals, onboarding, maturity)
    first_wins = _first_wins(signals, onboarding)
    return OnboardingStatePublic(
        maturity=maturity,
        signals=signals,
        demoAllowed=demo_allowed(),
        wizard=wizard,
        checklist=checklist,
        firstWins=first_wins,
        showWizard=should_show_wizard(wizard, maturity),
        showChecklist=checklist.visible,
    )


async def get_maturity(db, user: dict) -> AccountMaturityPublic:
    signals = await collect_signals(db, user["id"])
    return AccountMaturityPublic(
        maturity=compute_maturity(signals),
        signals=signals,
        demoAllowed=demo_allowed(),
    )


async def _load_user(db, user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail={"message": "Unauthorized."})
    return user


async def update_wizard(db, user_id: str, *, completed: Optional[bool], dismissed: Optional[bool], current_step: Optional[int]) -> OnboardingStatePublic:
    user = await _load_user(db, user_id)
    onboarding = dict(_onboarding_doc(user))
    now = _utc_now_iso()

    if current_step is not None:
        onboarding["wizardStep"] = current_step
    if dismissed is True:
        onboarding["wizardDismissed"] = True
    if completed is True:
        onboarding["wizardCompleted"] = True
        onboarding["wizardCompletedAt"] = now
        onboarding["wizardStep"] = 4

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"onboarding": onboarding, "updatedAt": now}},
    )
    user["onboarding"] = onboarding
    return await get_onboarding_state(db, user)


async def update_checklist(db, user_id: str, *, dismissed: Optional[bool]) -> OnboardingStatePublic:
    user = await _load_user(db, user_id)
    onboarding = dict(_onboarding_doc(user))
    now = _utc_now_iso()
    if dismissed is True:
        onboarding["checklistDismissed"] = True
        onboarding["checklistDismissedAt"] = now

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"onboarding": onboarding, "updatedAt": now}},
    )
    user["onboarding"] = onboarding
    return await get_onboarding_state(db, user)


async def mark_client_360_viewed(db, user_id: str) -> OnboardingStatePublic:
    user = await _load_user(db, user_id)
    onboarding = dict(_onboarding_doc(user))
    now = _utc_now_iso()
    if not onboarding.get("viewedClient360"):
        onboarding["viewedClient360"] = True
        onboarding["viewedClient360At"] = now
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"onboarding": onboarding, "updatedAt": now}},
        )
        user["onboarding"] = onboarding
    return await get_onboarding_state(db, user)


async def acknowledge_first_win(db, user_id: str, win_id: str) -> OnboardingStatePublic:
    if win_id not in FIRST_WIN_IDS:
        raise HTTPException(status_code=400, detail={"message": "Unknown first-win id."})
    user = await _load_user(db, user_id)
    onboarding = dict(_onboarding_doc(user))
    celebrated = dict(onboarding.get("firstWinsCelebrated") or {})
    now = _utc_now_iso()
    if win_id not in celebrated:
        celebrated[win_id] = now
        onboarding["firstWinsCelebrated"] = celebrated
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"onboarding": onboarding, "updatedAt": now}},
        )
        user["onboarding"] = onboarding
    return await get_onboarding_state(db, user)


def pending_first_win(state: OnboardingStatePublic) -> Optional[FirstWinPublic]:
    for win in state.firstWins:
        if win.achieved and not win.celebratedAt:
            return win
    return None
