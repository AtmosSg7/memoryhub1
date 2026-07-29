"""Client 360 — aggregate read model for the client dashboard."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from communication_center import (
    CommunicationPublic,
    communication_public,
    count_client_communications,
)
from integrations.account_service import account_public, get_account
from integrations.constants import ACCOUNT_STATUS_CONNECTED, PROVIDER_GMAIL, PROVIDER_GOOGLE_CONTACTS


class Client360IntegrationState(BaseModel):
    connected: bool = False
    accountEmail: Optional[str] = None
    lastSyncedAt: Optional[str] = None


class Client360Integrations(BaseModel):
    googleContacts: Client360IntegrationState = Field(default_factory=Client360IntegrationState)
    gmail: Client360IntegrationState = Field(default_factory=Client360IntegrationState)


class Client360Stats(BaseModel):
    exchangesTotal: int = 0
    emailsReceived: int = 0
    emailsSent: int = 0
    notesCount: int = 0
    documentsCount: int = 0
    quotesCount: int = 0
    invoicesCount: int = 0
    totalRevenue: int = 0
    lastActivityAt: Optional[str] = None
    lastGoogleSyncAt: Optional[str] = None


class Client360RecentDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    kind: str  # quote | invoice | file
    title: str
    number: Optional[str] = None
    updatedAt: Optional[str] = None


class Client360Response(BaseModel):
    clientId: str
    stats: Client360Stats
    integrations: Client360Integrations
    recentCommunications: List[CommunicationPublic] = Field(default_factory=list)
    recentDocuments: List[Client360RecentDoc] = Field(default_factory=list)
    recentEvents: List[Dict[str, Any]] = Field(default_factory=list)


def _max_iso(*values: Optional[str]) -> Optional[str]:
    best = None
    best_ms = -1
    for value in values:
        if not value:
            continue
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            ms = dt.timestamp()
        except ValueError:
            continue
        if ms > best_ms:
            best_ms = ms
            best = value
    return best


async def build_client_360(db, user_id: str, client_id: str) -> Client360Response:
    import asyncio

    from client_service import count_linked_records

    async def _revenue() -> int:
        # Same definition as client list / frontend: sum of payments on non-cancelled invoices.
        from kpi_definitions import compute_client_collected_revenue

        return await compute_client_collected_revenue(db, user_id, client_id)

    async def _recent_comms() -> List[CommunicationPublic]:
        cursor = (
            db.communications.find({"userId": user_id, "clientId": client_id}, {"_id": 0})
            .sort("createdAt", -1)
            .limit(8)
        )
        return [communication_public(doc) async for doc in cursor]

    async def _recent_events() -> List[Dict[str, Any]]:
        cursor = (
            db.events.find({"userId": user_id, "clientId": client_id}, {"_id": 0, "userId": 0})
            .sort("createdAt", -1)
            .limit(8)
        )
        return [doc async for doc in cursor]

    async def _recent_docs() -> List[Client360RecentDoc]:
        recent: List[Client360RecentDoc] = []
        async for q in (
            db.quotes.find({"userId": user_id, "clientId": client_id}, {"_id": 0})
            .sort("updatedAt", -1)
            .limit(3)
        ):
            recent.append(
                Client360RecentDoc(
                    id=q["id"],
                    kind="quote",
                    title=q.get("title") or "Devis",
                    number=q.get("number"),
                    updatedAt=q.get("updatedAt"),
                )
            )
        async for inv in (
            db.invoices.find({"userId": user_id, "clientId": client_id}, {"_id": 0})
            .sort("updatedAt", -1)
            .limit(3)
        ):
            recent.append(
                Client360RecentDoc(
                    id=inv["id"],
                    kind="invoice",
                    title=inv.get("title") or "Facture",
                    number=inv.get("number"),
                    updatedAt=inv.get("updatedAt"),
                )
            )
        async for f in (
            db.documents.find({"userId": user_id, "clientId": client_id}, {"_id": 0})
            .sort("updatedAt", -1)
            .limit(3)
        ):
            recent.append(
                Client360RecentDoc(
                    id=f["id"],
                    kind="file",
                    title=f.get("name") or "Fichier",
                    updatedAt=f.get("updatedAt"),
                )
            )
        recent.sort(key=lambda d: d.updatedAt or "", reverse=True)
        return recent[:6]

    (
        linked,
        exchange,
        total_revenue,
        client,
        last_event,
        last_comm,
        contacts_account,
        gmail_account,
        recent_comms,
        recent_docs,
        recent_events,
    ) = await asyncio.gather(
        count_linked_records(db, user_id, client_id),
        count_client_communications(db, user_id, client_id),
        _revenue(),
        db.clients.find_one(
            {"userId": user_id, "id": client_id},
            {"_id": 0, "updatedAt": 1, "createdAt": 1},
        ),
        db.events.find_one(
            {"userId": user_id, "clientId": client_id},
            {"_id": 0, "createdAt": 1},
            sort=[("createdAt", -1)],
        ),
        db.communications.find_one(
            {"userId": user_id, "clientId": client_id},
            {"_id": 0, "createdAt": 1},
            sort=[("createdAt", -1)],
        ),
        get_account(db, user_id, PROVIDER_GOOGLE_CONTACTS),
        get_account(db, user_id, PROVIDER_GMAIL),
        _recent_comms(),
        _recent_docs(),
        _recent_events(),
    )

    def _integration(account: Optional[dict]) -> Client360IntegrationState:
        if not account or account.get("status") != ACCOUNT_STATUS_CONNECTED:
            return Client360IntegrationState()
        pub = account_public(account)
        return Client360IntegrationState(
            connected=True,
            accountEmail=pub.accountEmail,
            lastSyncedAt=pub.lastSyncedAt,
        )

    last_google = _max_iso(
        (contacts_account or {}).get("lastSyncedAt"),
        (gmail_account or {}).get("lastSyncedAt"),
    )

    stats = Client360Stats(
        exchangesTotal=exchange["exchangesTotal"],
        emailsReceived=exchange["emailsReceived"],
        emailsSent=exchange["emailsSent"],
        notesCount=int(linked.get("notes") or 0),
        documentsCount=int(linked.get("documents") or 0),
        quotesCount=int(linked.get("quotes") or 0),
        invoicesCount=int(linked.get("invoices") or 0),
        totalRevenue=total_revenue,
        lastActivityAt=_max_iso(
            (client or {}).get("updatedAt"),
            (last_event or {}).get("createdAt"),
            (last_comm or {}).get("createdAt"),
        ),
        lastGoogleSyncAt=last_google,
    )

    return Client360Response(
        clientId=client_id,
        stats=stats,
        integrations=Client360Integrations(
            googleContacts=_integration(contacts_account),
            gmail=_integration(gmail_account),
        ),
        recentCommunications=recent_comms,
        recentDocuments=recent_docs,
        recentEvents=recent_events,
    )
