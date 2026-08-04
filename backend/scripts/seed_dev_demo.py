#!/usr/bin/env python3
"""Seed a realistic MemoryHub demo dataset in MongoDB for local dev.

Creates ~20 fictitious French artisan clients with quotes, invoices, payments,
notes, mock email communications, follow-ups and a couple of client portals,
spread over the last ~6 months. Refuses to run when ENV=production.

Idempotent: every seeded document is tagged with ``devSeedTag: SEED_TAG``. If
any client already carries this tag for the target user, the script prints a
summary of what already exists and exits 0 without writing anything new.

Usage:
    cd backend
    python3 scripts/seed_dev_user.py   # creates the target user if missing
    python3 scripts/seed_dev_demo.py
"""

import asyncio
import os
import sys
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env", override=False)

sys.path.insert(0, str(ROOT_DIR))

from communication_center import build_communication_doc  # noqa: E402
from events import record_event  # noqa: E402
from follow_up_service import record_follow_up  # noqa: E402
from invoice_payments import build_payment_update  # noqa: E402
from invoices import _invoice_event_metadata, insert_invoice_document  # noqa: E402
from portal_service import build_portal_url, ensure_client_portal  # noqa: E402
from quotes import insert_quote_document  # noqa: E402

SEED_TAG = "demo_v2"
DEFAULT_EMAIL = "atmossg7@gmail.com"
VAT_RATE = 20

# ---------------------------------------------------------------------------
# Demo dataset — fictitious French artisans, all @example.com, no real data.
# ---------------------------------------------------------------------------

# key, first, last, company, activity, city, status, created_days_ago
CLIENT_SPECS = [
    ("martin", "Julien", "Martin", "Martin Ébénisterie", "Ébénisterie sur mesure", "Nantes", "active", 178),
    ("dubois", "Sophie", "Dubois", "Dubois Plomberie", "Plomberie & chauffage", "Saint-Nazaire", "pending", 171),
    ("lefevre", "Marc", "Lefevre", "Lefevre Électricité", "Installation électrique", "Rennes", "active", 165),
    ("bernard", "Camille", "Bernard", "Bernard Maçonnerie", "Gros œuvre & rénovation", "Angers", "active", 158),
    ("petit", "Nicolas", "Petit", "Petit Peinture", "Peinture décorative", "Lyon", "dormant", 150),
    ("moreau", "Claire", "Moreau", "Moreau Couverture", "Couverture & zinguerie", "Bordeaux", "active", 143),
    ("laurent", "Thomas", "Laurent", "Laurent Menuiserie", "Menuiserie bois & PVC", "Toulouse", "new", 136),
    ("simon", "Emilie", "Simon", "Simon Carrelage", "Carrelage & faïence", "Lille", "active", 129),
    ("michel", "Alexandre", "Michel", "Michel Paysage", "Paysagisme & jardins", "Marseille", "pending", 122),
    ("garcia", "Manon", "Garcia", "Garcia Serrurerie", "Serrurerie & métallerie", "Nice", "active", 115),
    ("roux", "Antoine", "Roux", "Roux Chauffage", "Chauffage & climatisation", "Strasbourg", "active", 108),
    ("david", "Lea", "David", "David Vitrerie", "Vitrerie & miroiterie", "Montpellier", "dormant", 101),
    ("bertrand", "Hugo", "Bertrand", "Bertrand Plâtrerie", "Plâtrerie & isolation", "Nancy", "active", 94),
    ("fontaine", "Chloe", "Fontaine", "Fontaine Ferronnerie", "Ferronnerie d'art", "Reims", "new", 87),
    ("rousseau", "Maxime", "Rousseau", "Rousseau Terrassement", "Terrassement & VRD", "Le Mans", "active", 80),
    ("vincent", "Sarah", "Vincent", "Vincent Charpente", "Charpente traditionnelle", "Tours", "pending", 73),
    ("girard", "Romain", "Girard", "Girard Façades", "Ravalement de façades", "Dijon", "active", 66),
    ("faure", "Laura", "Faure", "Faure Isolation", "Isolation thermique", "Grenoble", "new", 59),
    ("andre", "Pierre", "Andre", "Andre Domotique", "Domotique & électricité", "Brest", "dormant", 45),
    ("mercier", "Julie", "Mercier", "Mercier Rénovation", "Rénovation générale", "Limoges", "active", 30),
]

# client_key, title, amount_ht (cents), status, quote_date_days_ago, accepted_days_ago, internal_notes
QUOTE_SPECS = [
    dict(key="dubois", title="Rénovation salle de bain", amount_ht=250_000, status="draft", quote_date_days_ago=5),
    dict(key="garcia", title="Remplacement serrure 3 points", amount_ht=45_000, status="draft", quote_date_days_ago=2),
    dict(
        key="martin",
        title="Bibliothèque chêne massif",
        amount_ht=404_167,
        status="sent",
        quote_date_days_ago=45,
        internal_notes="Client souhaite finition huilée.",
    ),
    dict(key="bernard", title="Extension garage", amount_ht=1_200_000, status="sent", quote_date_days_ago=20),
    dict(key="roux", title="Installation pompe à chaleur", amount_ht=980_000, status="sent", quote_date_days_ago=10),
    dict(
        key="lefevre",
        title="Mise aux normes tableau électrique",
        amount_ht=180_000,
        status="accepted",
        quote_date_days_ago=60,
        accepted_days_ago=55,
    ),
    dict(
        key="moreau",
        title="Réfection toiture ardoise",
        amount_ht=850_000,
        status="accepted",
        quote_date_days_ago=90,
        accepted_days_ago=85,
    ),
    dict(
        key="mercier",
        title="Rénovation complète appartement",
        amount_ht=2_500_000,
        status="accepted",
        quote_date_days_ago=25,
        accepted_days_ago=20,
    ),
    dict(key="simon", title="Carrelage terrasse 40m²", amount_ht=320_000, status="rejected", quote_date_days_ago=30),
    dict(key="girard", title="Ravalement façade 120m²", amount_ht=730_000, status="rejected", quote_date_days_ago=60),
    dict(key="petit", title="Peinture façade extérieure", amount_ht=280_000, status="expired", quote_date_days_ago=145),
    dict(
        key="laurent",
        title="Fabrication meuble sur mesure",
        amount_ht=395_000,
        status="expired",
        quote_date_days_ago=130,
    ),
]

# client_key, title, amount_ht (cents), invoice_date_days_ago, payment ("full" | "partial" | None), payment_days_ago
INVOICE_SPECS = [
    dict(
        key="martin",
        title="Bibliothèque chêne massif — acompte",
        amount_ht=100_000,
        invoice_date_days_ago=5,
        payment="partial",
        payment_days_ago=2,
    ),
    dict(key="dubois", title="Dépannage chauffe-eau", amount_ht=266_667, invoice_date_days_ago=50, payment=None),
    dict(
        key="lefevre",
        title="Tableau électrique",
        amount_ht=180_000,
        invoice_date_days_ago=12,
        payment="full",
        payment_days_ago=5,
    ),
    dict(key="bernard", title="Extension garage - acompte", amount_ht=360_000, invoice_date_days_ago=15, payment=None),
    dict(
        key="moreau",
        title="Toiture ardoise — solde",
        amount_ht=850_000,
        invoice_date_days_ago=80,
        payment="full",
        payment_days_ago=75,
    ),
    dict(key="simon", title="Pose carrelage cuisine", amount_ht=210_000, invoice_date_days_ago=48, payment=None),
    dict(
        key="garcia",
        title="Dépannage serrure urgence",
        amount_ht=15_000,
        invoice_date_days_ago=8,
        payment="full",
        payment_days_ago=6,
    ),
    dict(
        key="roux",
        title="Pompe à chaleur — acompte",
        amount_ht=300_000,
        invoice_date_days_ago=15,
        payment="partial",
        payment_days_ago=10,
    ),
    dict(key="bertrand", title="Cloisons — solde final", amount_ht=420_000, invoice_date_days_ago=7, payment=None),
    dict(
        key="mercier",
        title="Rénovation appartement — acompte",
        amount_ht=750_000,
        invoice_date_days_ago=12,
        payment="partial",
        payment_days_ago=8,
    ),
]

# client_key, note type, content, days_ago
NOTE_SPECS = [
    ("martin", "meeting", "RDV chantier bibliothèque : mesures prises, client présent.", 48),
    ("dubois", "phone", "Appel client : signale une fuite sous l'évier de la cuisine.", 52),
    ("bernard", "visit", "Visite du terrain pour le projet d'extension du garage.", 22),
    ("moreau", "general", "Client très satisfait de la réfection de toiture.", 70),
    ("simon", "reminder", "Penser à relancer pour le paiement de la facture carrelage.", 20),
    ("roux", "phone", "Devis pompe à chaleur envoyé, en attente de retour du client.", 9),
    ("bertrand", "general", "Matériaux commandés pour les cloisons, livraison prévue sous 5 jours.", 6),
    ("mercier", "meeting", "Réunion de suivi de chantier avec le client sur la rénovation.", 27),
]

# client_key, direction, subject, preview, days_ago
COMMUNICATION_SPECS = [
    (
        "martin",
        "inbound",
        "Question sur la finition de la bibliothèque",
        "Bonjour, est-il possible d'avoir une finition huilée plutôt que vernie ?",
        47,
    ),
    (
        "martin",
        "outbound",
        "Re: Question sur la finition de la bibliothèque",
        "Bonjour Julien, oui tout à fait, je vous confirme la finition huilée.",
        46,
    ),
    (
        "dubois",
        "inbound",
        "Fuite sous l'évier",
        "Bonjour, j'ai une fuite assez importante sous l'évier, pouvez-vous passer rapidement ?",
        53,
    ),
    (
        "bernard",
        "outbound",
        "Devis extension garage",
        "Bonjour, veuillez trouver ci-joint le devis pour l'extension du garage.",
        21,
    ),
    (
        "roux",
        "inbound",
        "Question pompe à chaleur",
        "Quel est le délai d'installation de la pompe à chaleur ?",
        9,
    ),
    (
        "mercier",
        "outbound",
        "Suivi chantier rénovation",
        "Bonjour, voici un point d'avancement sur les travaux de rénovation.",
        27,
    ),
]

# client_key of quotes (must be "sent") to record a manual follow-up on
FOLLOW_UP_QUOTE_KEYS = ["martin", "bernard"]

# client_keys to activate a portal for
PORTAL_CLIENT_KEYS = ["martin", "mercier"]


def _days_ago(days: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _client_display_name(doc: dict) -> str:
    return (doc.get("company") or doc.get("name") or "").strip()


def _slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return "".join(ch for ch in ascii_value.lower() if ch.isalnum())


def _phone_for_index(i: int) -> str:
    prefix = "06" if i % 2 == 0 else "07"
    a, b, c, d = 10 + i, 20 + i, 30 + i, 40 + i
    return f"{prefix} {a:02d} {b:02d} {c:02d} {d:02d}"


async def _find_user(db, email: str):
    return await db.users.find_one({"email": email.strip().lower()})


async def _seed_exists(db, user_id: str) -> bool:
    existing = await db.clients.find_one({"userId": user_id, "devSeedTag": SEED_TAG})
    return existing is not None


async def _print_existing_summary(db, user_id: str) -> None:
    counts = {}
    for name in ("clients", "quotes", "invoices", "notes", "communications"):
        counts[name] = await db[name].count_documents({"userId": user_id, "devSeedTag": SEED_TAG})
    portal = await db.client_portals.find_one(
        {"userId": user_id, "devSeedTag": SEED_TAG, "isActive": True},
        {"_id": 0, "token": 1},
    )
    print(f"Demo data already seeded ({SEED_TAG}).")
    print(
        f"Clients: {counts['clients']} | Quotes: {counts['quotes']} | Invoices: {counts['invoices']} | "
        f"Notes: {counts['notes']} | Communications: {counts['communications']}"
    )
    portal_url = build_portal_url(portal["token"]) if portal else "(aucun portail actif trouvé)"
    print(f"Portail (exemple) : {portal_url}")
    print("Login: http://localhost:3000/login")
    print("Pour repartir de zéro : python3 scripts/clear_dev_demo.py")


async def _insert_client(db, user_id: str, *, doc_fields: dict, created_days_ago: Optional[float] = None) -> dict:
    created_at = _days_ago(created_days_ago) if created_days_ago is not None else datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "devSeedTag": SEED_TAG,
        "createdAt": created_at,
        "updatedAt": created_at,
        **doc_fields,
    }
    await db.clients.insert_one(doc)
    await record_event(
        db,
        user_id,
        "client_created",
        "client",
        doc["id"],
        client_id=doc["id"],
        metadata={"clientName": _client_display_name(doc)},
    )
    return doc


async def _insert_note(db, user_id: str, client: dict, *, note_type: str, content: str, days_ago: float) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    note_date = _days_ago(days_ago)
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "devSeedTag": SEED_TAG,
        "title": None,
        "content": content,
        "clientId": client["id"],
        "clientName": _client_display_name(client),
        "type": note_type,
        "noteDate": note_date,
        "createdAt": note_date,
        "updatedAt": now,
    }
    await db.notes.insert_one(doc)
    await record_event(
        db,
        user_id,
        "note_created",
        "note",
        doc["id"],
        client_id=client["id"],
        metadata={
            "noteTitle": "Note sans titre",
            "noteType": note_type,
            "noteDate": note_date,
            "clientName": doc["clientName"],
            "excerpt": content[:120],
        },
    )
    return doc


async def _insert_communication(
    db,
    user_id: str,
    client: dict,
    *,
    direction: str,
    subject: str,
    preview: str,
    days_ago: float,
) -> dict:
    doc = build_communication_doc(
        user_id=user_id,
        type="email",
        client_id=client["id"],
        direction=direction,
        provider="mock_gmail",
        provider_id=f"seed-{uuid.uuid4()}",
        subject=subject,
        preview=preview,
        created_at=_days_ago(days_ago),
        metadata={
            "clientName": _client_display_name(client),
            "fromEmail": client.get("email") if direction == "inbound" else "dev@memoryhub.local",
            "channel": "email",
            "source": "mock_gmail",
        },
    )
    doc["devSeedTag"] = SEED_TAG
    await db.communications.insert_one(doc)
    return doc


async def _apply_payment(db, user_id: str, invoice: dict, amount: int, *, days_ago: float, note: str) -> dict:
    payment_result = build_payment_update(
        invoice,
        amount=amount,
        paid_at=_days_ago(days_ago),
        method="transfer",
        note=note,
    )
    update_fields = payment_result["update"]
    mongo_update: dict = {"$set": update_fields}
    if update_fields.get("status") != "paid":
        mongo_update["$unset"] = {"paidAt": ""}
    await db.invoices.update_one({"userId": user_id, "id": invoice["id"]}, mongo_update)
    merged = {**invoice, **update_fields}
    if update_fields.get("status") != "paid":
        merged.pop("paidAt", None)
    record = payment_result["record"]
    await record_event(
        db,
        user_id,
        "invoice_payment_recorded",
        "invoice",
        invoice["id"],
        client_id=merged.get("clientId"),
        metadata={
            **_invoice_event_metadata(merged),
            "paymentAmount": record.amount,
            "paymentMethod": record.method,
            "paymentDate": record.paidAt,
            "amountDue": payment_result["amountDue"],
        },
    )
    if payment_result["isFullyPaid"]:
        await record_event(
            db,
            user_id,
            "invoice_paid",
            "invoice",
            invoice["id"],
            client_id=merged.get("clientId"),
            metadata=_invoice_event_metadata(merged),
        )
    return merged


async def _seed_clients(db, user_id: str) -> dict:
    clients = {}
    for i, (key, first, last, company, activity, city, status, created_days_ago) in enumerate(CLIENT_SPECS):
        doc = await _insert_client(
            db,
            user_id,
            doc_fields={
                "name": f"{first} {last}",
                "contactName": f"{first} {last}",
                "company": company,
                "email": f"{_slug(first)}.{_slug(last)}@example.com",
                "phone": _phone_for_index(i),
                "activity": activity,
                "city": city,
                "status": status,
            },
            created_days_ago=created_days_ago,
        )
        clients[key] = doc
    return clients


async def _seed_quotes(db, user_id: str, clients: dict) -> dict:
    quotes = {}
    for spec in QUOTE_SPECS:
        client = clients[spec["key"]]
        quote = await insert_quote_document(
            db,
            user_id,
            client_id=client["id"],
            client_name=_client_display_name(client),
            title=spec["title"],
            amount_ht=spec["amount_ht"],
            vat_rate=VAT_RATE,
            quote_date=_days_ago(spec["quote_date_days_ago"]),
            status=spec["status"],
            internal_notes=spec.get("internal_notes"),
        )
        set_fields = {"devSeedTag": SEED_TAG}
        if spec["status"] == "sent":
            set_fields["sentAt"] = _days_ago(spec["quote_date_days_ago"])
        if spec["status"] == "accepted":
            set_fields["sentAt"] = _days_ago(spec["quote_date_days_ago"])
            set_fields["portalAcceptedAt"] = _days_ago(spec["accepted_days_ago"])
            set_fields["updatedAt"] = _days_ago(spec["accepted_days_ago"])
        await db.quotes.update_one({"userId": user_id, "id": quote["id"]}, {"$set": set_fields})
        quote.update(set_fields)
        quotes[spec["key"] + ":" + spec["title"]] = quote
    return quotes


async def _seed_invoices(db, user_id: str, clients: dict) -> list:
    invoices = []
    for spec in INVOICE_SPECS:
        client = clients[spec["key"]]
        invoice = await insert_invoice_document(
            db,
            user_id,
            client_id=client["id"],
            client_name=_client_display_name(client),
            title=spec["title"],
            amount_ht=spec["amount_ht"],
            vat_rate=VAT_RATE,
            invoice_date=_days_ago(spec["invoice_date_days_ago"]),
            status="in_progress",
        )
        await db.invoices.update_one(
            {"userId": user_id, "id": invoice["id"]},
            {"$set": {"devSeedTag": SEED_TAG}},
        )
        invoice["devSeedTag"] = SEED_TAG

        payment_kind = spec.get("payment")
        if payment_kind == "full":
            invoice = await _apply_payment(
                db,
                user_id,
                invoice,
                invoice["amountTTC"],
                days_ago=spec["payment_days_ago"],
                note="Paiement intégral reçu par virement",
            )
        elif payment_kind == "partial":
            half = invoice["amountTTC"] // 2
            invoice = await _apply_payment(
                db,
                user_id,
                invoice,
                half,
                days_ago=spec["payment_days_ago"],
                note="Acompte reçu par virement",
            )
        invoices.append(invoice)
    return invoices


async def _seed_notes(db, user_id: str, clients: dict) -> list:
    notes = []
    for key, note_type, content, days_ago in NOTE_SPECS:
        note = await _insert_note(db, user_id, clients[key], note_type=note_type, content=content, days_ago=days_ago)
        notes.append(note)
    return notes


async def _insert_unlinked_communication(
    db,
    user_id: str,
    *,
    subject: str,
    preview: str,
    days_ago: float,
    from_email: str,
) -> dict:
    doc = build_communication_doc(
        user_id=user_id,
        type="email",
        client_id=None,
        direction="inbound",
        provider="mock_gmail",
        provider_id=f"seed-unlinked-{uuid.uuid4()}",
        subject=subject,
        preview=preview,
        created_at=_days_ago(days_ago),
        metadata={
            "fromEmail": from_email,
            "channel": "email",
            "source": "mock_gmail",
            "unlinked": True,
        },
    )
    doc["devSeedTag"] = SEED_TAG
    await db.communications.insert_one(doc)
    return doc


async def _seed_communications(db, user_id: str, clients: dict) -> list:
    comms = []
    for key, direction, subject, preview, days_ago in COMMUNICATION_SPECS:
        comm = await _insert_communication(
            db,
            user_id,
            clients[key],
            direction=direction,
            subject=subject,
            preview=preview,
            days_ago=days_ago,
        )
        comms.append(comm)
    # Unclassified inbox samples for Communication Center demos
    for subject, preview, days_ago, from_email in (
        (
            "Demande de devis toiture",
            "Bonjour, pourriez-vous me chiffrer une réfection de toiture ?",
            1.5,
            "prospect.inconnu@example.com",
        ),
        (
            "Facture fournisseur — relance",
            "Bonjour, avez-vous bien reçu notre facture du mois dernier ?",
            4.0,
            "fournisseur.demo@example.com",
        ),
    ):
        comms.append(
            await _insert_unlinked_communication(
                db,
                user_id,
                subject=subject,
                preview=preview,
                days_ago=days_ago,
                from_email=from_email,
            )
        )
    return comms


async def _seed_follow_ups(db, user_id: str, quotes: dict) -> list:
    follow_ups = []
    for key in FOLLOW_UP_QUOTE_KEYS:
        quote = next(q for lookup_key, q in quotes.items() if lookup_key.startswith(f"{key}:"))
        client_first_name = quote["clientName"].split()[0] if quote.get("clientName") else "Bonjour"
        result = await record_follow_up(
            db,
            user_id,
            entity_type="quote",
            entity_id=quote["id"],
            subject=f"Relance devis {quote['number']}",
            message=(
                f"Bonjour,\n\n"
                f"Je me permets de revenir vers vous concernant le devis {quote['number']} "
                f"« {quote.get('title', '')} ».\n\n"
                "Avez-vous eu l'occasion de l'examiner ?\n\n"
                "Cordialement,\nBasera Dev"
            ),
            lang="fr",
            company_name="Basera Dev",
        )
        follow_ups.append(result)
    return follow_ups


async def _seed_portals(db, user_id: str, clients: dict) -> list:
    portals = []
    for key in PORTAL_CLIENT_KEYS:
        client = clients[key]
        portal = await ensure_client_portal(db, user_id, client["id"])
        await db.client_portals.update_one({"id": portal["id"]}, {"$set": {"devSeedTag": SEED_TAG}})
        portals.append((client, portal))
    return portals


async def _tag_events_for_clients(db, user_id: str, clients: dict) -> None:
    client_ids = [doc["id"] for doc in clients.values()]
    await db.events.update_many(
        {"userId": user_id, "clientId": {"$in": client_ids}},
        {"$set": {"devSeedTag": SEED_TAG}},
    )


async def _seed_demo(db, user_id: str) -> dict:
    clients = await _seed_clients(db, user_id)
    quotes = await _seed_quotes(db, user_id, clients)
    invoices = await _seed_invoices(db, user_id, clients)
    notes = await _seed_notes(db, user_id, clients)
    communications = await _seed_communications(db, user_id, clients)
    follow_ups = await _seed_follow_ups(db, user_id, quotes)
    portals = await _seed_portals(db, user_id, clients)
    await _tag_events_for_clients(db, user_id, clients)

    return {
        "clients": clients,
        "quotes": quotes,
        "invoices": invoices,
        "notes": notes,
        "communications": communications,
        "follow_ups": follow_ups,
        "portals": portals,
    }


def _count_statuses(items, key: str) -> dict:
    counts: dict = {}
    for item in items:
        value = item.get(key, "unknown")
        counts[value] = counts.get(value, 0) + 1
    return counts


async def _async_main() -> int:
    if os.environ.get("ENV", "development").lower() == "production":
        print("ERROR: seed_dev_demo.py cannot run when ENV=production.", file=sys.stderr)
        return 1

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("ERROR: Set MONGO_URL and DB_NAME in backend/.env", file=sys.stderr)
        return 1

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    user = await _find_user(db, DEFAULT_EMAIL)
    if not user:
        print(f"ERROR: No user {DEFAULT_EMAIL}. Run: python3 scripts/seed_dev_user.py", file=sys.stderr)
        return 1

    user_id = user["id"]
    if await _seed_exists(db, user_id):
        await _print_existing_summary(db, user_id)
        return 0

    result = await _seed_demo(db, user_id)

    quote_status_counts = _count_statuses(result["quotes"].values(), "status")
    invoice_status_counts = _count_statuses(result["invoices"], "status")

    print("Demo data seeded successfully.")
    print(f"Tag: {SEED_TAG}")
    print(f"Clients: {len(result['clients'])}")
    print(
        "Devis: "
        + ", ".join(f"{count} {status}" for status, count in sorted(quote_status_counts.items()))
        + f" ({len(result['quotes'])} total)"
    )
    print(
        "Factures: "
        + ", ".join(f"{count} {status}" for status, count in sorted(invoice_status_counts.items()))
        + f" ({len(result['invoices'])} total)"
    )
    print(f"Notes: {len(result['notes'])}")
    print(f"Communications (mock Gmail): {len(result['communications'])}")
    print(f"Relances enregistrées: {len(result['follow_ups'])}")
    for client, portal in result["portals"]:
        print(f"Portail {_client_display_name(client)}: {build_portal_url(portal['token'])}")
    print("Login: http://localhost:3000/login")
    print("Pour supprimer ces données de démo : python3 scripts/clear_dev_demo.py")
    return 0


def main() -> int:
    return asyncio.run(_async_main())


if __name__ == "__main__":
    sys.exit(main())
