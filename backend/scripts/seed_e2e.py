#!/usr/bin/env python3
"""Deterministic E2E seed — NEVER run when ENV=production."""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env", override=False)
sys.path.insert(0, str(ROOT))

from admin_constants import USER_ROLE_ADMIN  # noqa: E402
from auth import build_user_document  # noqa: E402
from credit_seed import seed_credit_catalog  # noqa: E402
from credit_service import grant_monthly_credits, grant_permanent_credits  # noqa: E402
from e2e_db_guard import resolve_e2e_db_name  # noqa: E402

E2E_TAG = "e2e_rc_v1"
E2E_DB = resolve_e2e_db_name()

USERS = {
    "artisan_a": {
        "email": "artisan-a@e2e.example.com",
        "password": "E2ePassw0rd!A",
        "firstName": "Alice",
        "lastName": "Artisan",
        "companyName": "Atelier Alice",
        "role": "user",
    },
    "artisan_b": {
        "email": "artisan-b@e2e.example.com",
        "password": "E2ePassw0rd!B",
        "firstName": "Bob",
        "lastName": "Bâtisseur",
        "companyName": "Bob Rénovation",
        "role": "user",
    },
    "admin": {
        "email": "admin@e2e.example.com",
        "password": "E2eAdminPass1!",
        "firstName": "Founder",
        "lastName": "Admin",
        "companyName": "Basera Ops",
        "role": USER_ROLE_ADMIN,
    },
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


async def _ensure_user(db, spec: dict) -> dict:
    email = spec["email"].lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        return existing

    doc = build_user_document(
        first_name=spec["firstName"],
        last_name=spec["lastName"],
        company_name=spec["companyName"],
        email=email,
        password=spec["password"],
        email_verified=True,
    )
    doc["role"] = spec.get("role", "user")
    doc["e2eSeedTag"] = E2E_TAG
    await db.users.insert_one(doc)
    return doc


async def _seed_commercial(db, user_id: str, client_id: str, client_name: str) -> None:
    now = _now()
    quote_sent = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "number": "DEV-E2E-001",
        "clientId": client_id,
        "clientName": client_name,
        "title": "Devis E2E envoyé",
        "status": "sent",
        "amountHT": 25000,
        "vatRate": 20,
        "amountTTC": 30000,
        "createdAt": _days_ago(5),
        "updatedAt": now,
        "e2eSeedTag": E2E_TAG,
    }
    quote_accepted = {
        **quote_sent,
        "id": str(uuid.uuid4()),
        "number": "DEV-E2E-002",
        "title": "Devis E2E accepté",
        "status": "accepted",
    }
    await db.quotes.insert_many([quote_sent, quote_accepted])

    invoice_open = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "number": "FAC-E2E-001",
        "clientId": client_id,
        "clientName": client_name,
        "title": "Facture E2E ouverte",
        "status": "sent",
        "amountHT": 10000,
        "vatRate": 20,
        "amountTTC": 12000,
        "amountPaid": 0,
        "createdAt": _days_ago(3),
        "updatedAt": now,
        "e2eSeedTag": E2E_TAG,
    }
    await db.invoices.insert_one(invoice_open)


async def run_seed() -> None:
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db = AsyncIOMotorClient(mongo_url)[E2E_DB]

    await seed_credit_catalog(db)

    user_a = await _ensure_user(db, USERS["artisan_a"])
    user_b = await _ensure_user(db, USERS["artisan_b"])
    await _ensure_user(db, USERS["admin"])

    for user in (user_a, user_b):
        await grant_monthly_credits(db, user["id"], "solo")
        await grant_permanent_credits(db, user["id"], 50, source="e2e_seed")

    client_a = {
        "id": str(uuid.uuid4()),
        "userId": user_a["id"],
        "name": "Client E2E Dupont",
        "email": "client.dupont@e2e.example.com",
        "status": "active",
        "createdAt": _days_ago(10),
        "updatedAt": _now(),
        "e2eSeedTag": E2E_TAG,
    }
    await db.clients.insert_one(client_a)
    await _seed_commercial(db, user_a["id"], client_a["id"], client_a["name"])

    await db.notes.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user_a["id"],
            "clientId": client_a["id"],
            "type": "general",
            "content": "Note E2E seed",
            "createdAt": _days_ago(2),
            "updatedAt": _now(),
            "e2eSeedTag": E2E_TAG,
        }
    )

    await db.user_subscriptions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "userId": user_a["id"],
            "planId": "solo",
            "status": "active",
            "currentPeriodEnd": (datetime.now(timezone.utc) + timedelta(days=20)).isoformat(),
            "createdAt": _days_ago(30),
            "updatedAt": _now(),
            "e2eSeedTag": E2E_TAG,
        }
    )


def main() -> int:
    if os.environ.get("ENV", "development").lower() == "production":
        print("ERROR: seed_e2e.py cannot run when ENV=production.", file=sys.stderr)
        return 1
    if os.environ.get("ALLOW_E2E_SEED", "").lower() not in {"1", "true", "yes"}:
        print("Set ALLOW_E2E_SEED=1 to run E2E seed.", file=sys.stderr)
        return 1

    asyncio.run(run_seed())
    print(f"E2E seed complete in database: {E2E_DB}")
    for key, spec in USERS.items():
        print(f"  {key}: {spec['email']} / {spec['password']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
