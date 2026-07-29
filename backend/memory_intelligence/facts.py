"""Batch fact builders for Memory Intelligence."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from client_service import aggregate_client_list_stats, client_display_name
from memory_intelligence.models import ClientFacts, WorkspaceFacts


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _days_between(later: datetime, earlier: Optional[datetime]) -> Optional[int]:
    if not earlier:
        return None
    return max(0, int((later - earlier).total_seconds() // 86400))


def _has_phone(client: dict) -> bool:
    if (client.get("phone") or "").strip():
        return True
    for item in client.get("phones") or []:
        if isinstance(item, dict) and (item.get("value") or "").strip():
            return True
    return False


def _has_email(client: dict) -> bool:
    if (client.get("email") or "").strip():
        return True
    for item in client.get("emails") or []:
        if isinstance(item, dict) and (item.get("value") or "").strip():
            return True
    return False


def _has_address(client: dict) -> bool:
    if (client.get("address") or "").strip() or (client.get("city") or "").strip():
        return True
    for item in client.get("addresses") or []:
        if isinstance(item, dict) and (
            (item.get("line1") or "").strip() or (item.get("city") or "").strip()
        ):
            return True
    return False


async def _exchange_counts_by_client(db, user_id: str) -> Dict[str, Dict[str, int]]:
    """Single aggregation — exchanges / emails in / out per client."""
    cursor = db.communications.aggregate(
        [
            {
                "$match": {
                    "userId": user_id,
                    "clientId": {"$exists": True, "$nin": [None, ""]},
                }
            },
            {
                "$group": {
                    "_id": "$clientId",
                    "exchangesTotal": {"$sum": 1},
                    "emailsReceived": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$and": [
                                        {"$eq": ["$type", "email"]},
                                        {"$eq": ["$direction", "inbound"]},
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                    "emailsSent": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$and": [
                                        {"$eq": ["$type", "email"]},
                                        {"$eq": ["$direction", "outbound"]},
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
        ]
    )
    out: Dict[str, Dict[str, int]] = {}
    async for row in cursor:
        cid = row.get("_id")
        if not cid:
            continue
        out[str(cid)] = {
            "exchangesTotal": int(row.get("exchangesTotal") or 0),
            "emailsReceived": int(row.get("emailsReceived") or 0),
            "emailsSent": int(row.get("emailsSent") or 0),
        }
    return out


async def _quote_invoice_counts(db, user_id: str) -> Dict[str, Dict[str, int]]:
    result: Dict[str, Dict[str, int]] = {}
    for collection, key in (("quotes", "quotesCount"), ("invoices", "invoicesCount")):
        cursor = db[collection].aggregate(
            [
                {
                    "$match": {
                        "userId": user_id,
                        "clientId": {"$exists": True, "$nin": [None, ""]},
                        "status": {"$ne": "archived"},
                    }
                },
                {"$group": {"_id": "$clientId", "n": {"$sum": 1}}},
            ]
        )
        async for row in cursor:
            cid = str(row["_id"]) if row.get("_id") else None
            if not cid:
                continue
            result.setdefault(cid, {"quotesCount": 0, "invoicesCount": 0})
            result[cid][key] = int(row.get("n") or 0)
    return result


async def build_workspace_facts(db, user_id: str) -> WorkspaceFacts:
    from integrations.account_service import get_account
    from integrations.constants import ACCOUNT_STATUS_CONNECTED, PROVIDER_GMAIL, PROVIDER_GOOGLE_CONTACTS
    from unlinked_email_service import count_unlinked_emails

    contacts = await get_account(db, user_id, PROVIDER_GOOGLE_CONTACTS)
    gmail = await get_account(db, user_id, PROVIDER_GMAIL)
    unlinked = await count_unlinked_emails(db, user_id)

    def _connected(account: Optional[dict]) -> Tuple[bool, Optional[str]]:
        if not account or account.get("status") != ACCOUNT_STATUS_CONNECTED:
            return False, None
        return True, account.get("lastSyncedAt")

    gc_ok, gc_sync = _connected(contacts)
    gm_ok, gm_sync = _connected(gmail)
    return WorkspaceFacts(
        googleContactsConnected=gc_ok,
        googleContactsLastSyncedAt=gc_sync,
        gmailConnected=gm_ok,
        gmailLastSyncedAt=gm_sync,
        unlinkedEmailCount=unlinked,
    )


async def build_all_client_facts(db, user_id: str) -> List[ClientFacts]:
    """Load all client facts with batch aggregations (no N+1)."""
    now = datetime.now(timezone.utc)
    list_stats = await aggregate_client_list_stats(db, user_id)
    exchanges = await _exchange_counts_by_client(db, user_id)
    qi_counts = await _quote_invoice_counts(db, user_id)

    clients = [
        doc
        async for doc in db.clients.find({"userId": user_id}, {"_id": 0}).sort("updatedAt", -1)
    ]

    facts: List[ClientFacts] = []
    for doc in clients:
        cid = doc["id"]
        stats = list_stats.get(cid) or {}
        ex = exchanges.get(cid) or {}
        qi = qi_counts.get(cid) or {}
        created = _parse_iso(doc.get("createdAt"))
        last_activity = _parse_iso(stats.get("lastActivityAt") or doc.get("updatedAt") or doc.get("createdAt"))
        display = client_display_name(doc)
        facts.append(
            ClientFacts(
                clientId=cid,
                name=doc.get("name") or "",
                company=doc.get("company"),
                displayName=display,
                email=doc.get("email"),
                phone=doc.get("phone"),
                hasEmail=_has_email(doc),
                hasPhone=_has_phone(doc),
                hasAddress=_has_address(doc),
                createdAt=doc.get("createdAt"),
                updatedAt=doc.get("updatedAt"),
                lastActivityAt=stats.get("lastActivityAt") or doc.get("updatedAt"),
                daysSinceCreated=_days_between(now, created),
                daysSinceActivity=_days_between(now, last_activity),
                exchangesTotal=int(ex.get("exchangesTotal") or 0),
                emailsReceived=int(ex.get("emailsReceived") or 0),
                emailsSent=int(ex.get("emailsSent") or 0),
                notesCount=int(stats.get("notesCount") or 0),
                documentsCount=int(stats.get("documentsCount") or 0),
                quotesCount=int(qi.get("quotesCount") or 0),
                invoicesCount=int(qi.get("invoicesCount") or 0),
                totalRevenue=int(stats.get("totalRevenue") or 0),
                isFavorite=bool(doc.get("isFavorite")),
                phoneCallCount=0,
                whatsappCount=0,
                calendarEventCount=0,
            )
        )
    return facts


async def build_single_client_facts(db, user_id: str, client_id: str) -> Optional[ClientFacts]:
    """Targeted recompute for one client."""
    doc = await db.clients.find_one({"userId": user_id, "id": client_id}, {"_id": 0})
    if not doc:
        return None
    # Reuse batch helpers filtered — still cheap for one client via dedicated counts
    now = datetime.now(timezone.utc)
    from communication_center import count_client_communications
    from client_service import count_linked_records

    linked = await count_linked_records(db, user_id, client_id)
    exchange = await count_client_communications(db, user_id, client_id)

    # Revenue like list stats
    revenue = 0
    async for inv in db.invoices.find(
        {"userId": user_id, "clientId": client_id, "status": {"$ne": "cancelled"}},
        {"_id": 0, "amountPaid": 1, "amountTTC": 1, "status": 1},
    ):
        paid = int(inv.get("amountPaid") or 0)
        if paid <= 0 and inv.get("status") == "paid":
            paid = int(inv.get("amountTTC") or 0)
        revenue += max(0, paid)

    quotes = await db.quotes.count_documents(
        {"userId": user_id, "clientId": client_id, "status": {"$ne": "archived"}}
    )
    invoices = await db.invoices.count_documents(
        {"userId": user_id, "clientId": client_id, "status": {"$ne": "archived"}}
    )

    last_event = await db.events.find_one(
        {"userId": user_id, "clientId": client_id},
        {"_id": 0, "createdAt": 1},
        sort=[("createdAt", -1)],
    )
    last_comm = await db.communications.find_one(
        {"userId": user_id, "clientId": client_id},
        {"_id": 0, "createdAt": 1},
        sort=[("createdAt", -1)],
    )
    last_candidates = [
        doc.get("updatedAt"),
        doc.get("createdAt"),
        (last_event or {}).get("createdAt"),
        (last_comm or {}).get("createdAt"),
    ]
    last_activity_at = max((c for c in last_candidates if c), default=None)
    created = _parse_iso(doc.get("createdAt"))
    last_activity = _parse_iso(last_activity_at)

    return ClientFacts(
        clientId=client_id,
        name=doc.get("name") or "",
        company=doc.get("company"),
        displayName=client_display_name(doc),
        email=doc.get("email"),
        phone=doc.get("phone"),
        hasEmail=_has_email(doc),
        hasPhone=_has_phone(doc),
        hasAddress=_has_address(doc),
        createdAt=doc.get("createdAt"),
        updatedAt=doc.get("updatedAt"),
        lastActivityAt=last_activity_at,
        daysSinceCreated=_days_between(now, created),
        daysSinceActivity=_days_between(now, last_activity),
        exchangesTotal=int(exchange.get("exchangesTotal") or 0),
        emailsReceived=int(exchange.get("emailsReceived") or 0),
        emailsSent=int(exchange.get("emailsSent") or 0),
        notesCount=int(linked.get("notes") or 0),
        documentsCount=int(linked.get("documents") or 0),
        quotesCount=int(quotes),
        invoicesCount=int(invoices),
        totalRevenue=revenue,
        isFavorite=bool(doc.get("isFavorite")),
    )
