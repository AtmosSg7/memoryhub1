import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env", override=False)

from security_config import IS_DEPLOYED, IS_PRODUCTION, cors_origins, validate_security_config
from security_headers import SecurityHeadersMiddleware
from observability import get_logger, init_observability, register_observability_handlers
from rate_limit import rate_limit

waitlist_rate_limit = rate_limit(max_requests=10, window_seconds=3600)

from credit_seed import seed_credit_catalog
from db_indexes import ensure_index, drop_index_if_exists

validate_security_config()
init_observability()

from auth import auth_router
from clients import clients_router
from notes import notes_router
from documents import documents_router
from search import search_router
from events import events_router
from quotes import quotes_router
from invoices import invoices_router
from imports import imports_router
from catalog import catalog_router
from reminders import reminders_router
from personal_reminders import personal_reminders_router
from portal import portal_router, portal_admin_router
from communications import communications_router
from follow_ups import follow_ups_router
from document_sends import document_sends_router
from analytics.routes import analytics_router
from analytics.cache import invalidate_user as invalidate_analytics_cache
from dashboard_stats import dashboard_router
from memory_intelligence.routes import intelligence_router
from credits import credits_router
from subscriptions import subscriptions_router
from commercial_workflow import commercial_router
from billing import billing_router, stripe_router
from company_profile import company_profile_router
from emails_dev import emails_dev_router
from dev_demo import dev_demo_router
from admin import admin_router
from integrations.routes import integrations_router
from onboarding import onboarding_router
from beta_feedback import beta_feedback_router

logger = get_logger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(
    docs_url=None if IS_DEPLOYED else "/docs",
    redoc_url=None if IS_DEPLOYED else "/redoc",
    openapi_url=None if IS_DEPLOYED else "/openapi.json",
)
app.state.db = db
register_observability_handlers(app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class WaitlistCreate(BaseModel):
    email: EmailStr
    language: Optional[Literal["fr", "en"]] = None

class WaitlistResponse(BaseModel):
    message: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.get("/health")
async def health_check():
    """Liveness probe — process is running."""
    return {"status": "ok"}


@api_router.get("/ready")
async def readiness_check():
    """Readiness probe — MongoDB and critical dependencies available."""
    try:
        await db.command("ping")
    except Exception:
        logger.exception("Readiness check failed: MongoDB ping")
        raise HTTPException(
            status_code=503,
            detail={"message": "Service not ready.", "mongo": "down"},
        )
    return {"status": "ready", "mongo": "ok"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    if IS_DEPLOYED:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    if IS_DEPLOYED:
        raise HTTPException(status_code=404, detail={"message": "Not found."})
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

@api_router.post("/waitlist", response_model=WaitlistResponse, status_code=201)
async def join_waitlist(input: WaitlistCreate, _rate=Depends(waitlist_rate_limit)):
    email = input.email.strip().lower()
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "language": input.language,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.waitlist.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail={"message": "This email is already on the waitlist."},
        )
    except Exception:
        logger.exception("Failed to add email to waitlist")
        raise HTTPException(
            status_code=500,
            detail={"message": "Something went wrong. Please try again later."},
        )
    return WaitlistResponse(message="Successfully joined the waitlist.")

api_router.include_router(auth_router)
api_router.include_router(clients_router)
api_router.include_router(notes_router)
api_router.include_router(documents_router)
api_router.include_router(search_router)
api_router.include_router(events_router)
api_router.include_router(quotes_router)
api_router.include_router(invoices_router)
api_router.include_router(commercial_router)
api_router.include_router(company_profile_router)
api_router.include_router(integrations_router)
api_router.include_router(imports_router)
api_router.include_router(catalog_router)
api_router.include_router(reminders_router)
api_router.include_router(personal_reminders_router)
api_router.include_router(portal_router)
api_router.include_router(portal_admin_router)
api_router.include_router(communications_router)
api_router.include_router(follow_ups_router)
api_router.include_router(document_sends_router)
api_router.include_router(dashboard_router)
api_router.include_router(analytics_router)
api_router.include_router(intelligence_router)
api_router.include_router(onboarding_router)
api_router.include_router(beta_feedback_router)
api_router.include_router(credits_router)
api_router.include_router(subscriptions_router)
api_router.include_router(billing_router)
api_router.include_router(stripe_router)
if not IS_DEPLOYED:
    api_router.include_router(emails_dev_router)
    api_router.include_router(dev_demo_router)
api_router.include_router(admin_router)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_indexes():
    await db.waitlist.create_index("email", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("stripeCustomerId", unique=True, sparse=True)
    await db.users.create_index("emailVerificationToken", sparse=True)
    await db.users.create_index("passwordResetToken", sparse=True)
    await db.clients.create_index("id", unique=True)
    await db.clients.create_index([("userId", 1), ("updatedAt", -1)])
    await db.clients.create_index([("userId", 1), ("status", 1)])
    await db.clients.create_index([("userId", 1), ("isFavorite", 1)])
    await db.clients.create_index([("userId", 1), ("tags", 1)])
    await db.notes.create_index("id", unique=True)
    await db.notes.create_index([("userId", 1), ("updatedAt", -1)])
    await db.notes.create_index([("userId", 1), ("clientId", 1), ("updatedAt", -1)])
    await db.notes.create_index([("userId", 1), ("noteDate", -1)])
    await db.notes.create_index([("userId", 1), ("clientId", 1), ("noteDate", -1)])
    await db.notes.create_index([("userId", 1), ("type", 1), ("noteDate", -1)])
    await db.personal_reminders.create_index("id", unique=True)
    await db.personal_reminders.create_index([("userId", 1), ("noteId", 1)])
    await db.personal_reminders.create_index([("userId", 1), ("status", 1), ("remindAt", 1)])
    await db.documents.create_index("id", unique=True)
    await db.documents.create_index([("userId", 1), ("updatedAt", -1)])
    await db.documents.create_index([("userId", 1), ("clientId", 1), ("updatedAt", -1)])
    await db.events.create_index("id", unique=True)
    await db.events.create_index([("userId", 1), ("createdAt", -1)])
    await db.events.create_index([("userId", 1), ("clientId", 1), ("createdAt", -1)])
    await db.events.create_index([("userId", 1), ("type", 1), ("createdAt", -1)])
    await db.events.create_index(
        [("userId", 1), ("clientId", 1), ("type", 1), ("createdAt", -1)]
    )
    await db.quotes.create_index("id", unique=True)
    await db.quotes.create_index([("userId", 1), ("number", 1)], unique=True)
    await db.quotes.create_index([("userId", 1), ("quoteDate", -1)])
    await db.quotes.create_index([("userId", 1), ("clientId", 1), ("quoteDate", -1)])
    await db.quotes.create_index([("userId", 1), ("status", 1), ("quoteDate", -1)])
    await db.quotes.create_index([("userId", 1), ("clientId", 1), ("updatedAt", -1)])
    await db.invoices.create_index("id", unique=True)
    await db.invoices.create_index([("userId", 1), ("number", 1)], unique=True)
    await db.invoices.create_index([("userId", 1), ("invoiceDate", -1)])
    await db.invoices.create_index([("userId", 1), ("clientId", 1), ("invoiceDate", -1)])
    await db.invoices.create_index([("userId", 1), ("status", 1), ("invoiceDate", -1)])
    await db.invoices.create_index([("userId", 1), ("clientId", 1), ("updatedAt", -1)])
    # Analytics: paid revenue by paidAt + createdAt series for clients/quotes/invoices
    await ensure_index(
        db.invoices,
        [("userId", 1), ("paidAt", -1)],
        name="invoices_userId_paidAt",
        sparse=True,
    )
    await ensure_index(
        db.invoices,
        [("userId", 1), ("createdAt", -1)],
        name="invoices_userId_createdAt",
    )
    await ensure_index(
        db.quotes,
        [("userId", 1), ("createdAt", -1)],
        name="quotes_userId_createdAt",
    )
    await ensure_index(
        db.clients,
        [("userId", 1), ("createdAt", -1)],
        name="clients_userId_createdAt",
    )
    await db.import_sessions.create_index("id", unique=True)
    await db.import_sessions.create_index([("userId", 1), ("createdAt", -1)])
    await db.import_sessions.create_index([("userId", 1), ("status", 1), ("createdAt", -1)])
    await db.quotes.create_index([("userId", 1), ("clientId", 1), ("externalNumber", 1)], sparse=True)
    await db.invoices.create_index([("userId", 1), ("clientId", 1), ("externalNumber", 1)], sparse=True)
    await db.catalog_items.create_index("id", unique=True)
    await db.catalog_items.create_index([("userId", 1), ("normalizedKey", 1)], unique=True)
    await db.catalog_items.create_index([("userId", 1), ("lastUsedAt", -1)])
    await db.catalog_items.create_index([("userId", 1), ("usageCount", -1)])
    await db.catalog_meta.create_index("userId", unique=True)
    await db.client_portals.create_index("id", unique=True)
    await db.client_portals.create_index("token", unique=True)
    await db.client_portals.create_index([("userId", 1), ("clientId", 1)], unique=True)
    await db.email_messages.create_index("id", unique=True)
    await db.email_messages.create_index([("userId", 1), ("clientId", 1), ("sentAt", -1)], sparse=True)
    await ensure_index(
        db.email_messages,
        [("userId", 1), ("provider", 1), ("providerMessageId", 1)],
        name="email_messages_user_provider_msgid_unique",
        unique=True,
        partialFilterExpression={"providerMessageId": {"$exists": True}},
    )
    await db.email_messages.create_index([("userId", 1), ("sentAt", -1)])

    # Communication Center — canonical interaction layer
    await ensure_index(db.communications, "id", name="communications_id_unique", unique=True)
    await ensure_index(
        db.communications,
        [("userId", 1), ("provider", 1), ("providerId", 1)],
        name="communications_user_provider_id_unique",
        unique=True,
        partialFilterExpression={"providerId": {"$exists": True, "$type": "string"}},
    )
    await db.communications.create_index([("userId", 1), ("createdAt", -1)])
    await db.communications.create_index([("userId", 1), ("clientId", 1), ("createdAt", -1)])
    await db.communications.create_index([("userId", 1), ("type", 1), ("createdAt", -1)])
    await db.communications.create_index(
        [("userId", 1), ("clientId", 1), ("type", 1), ("direction", 1)]
    )
    await db.communications.create_index([("userId", 1), ("subject", 1)])
    await db.communications.create_index([("userId", 1), ("preview", 1)])
    # Unlinked inbox — type + missing clientId + ignoredAt + sort
    await db.communications.create_index(
        [("userId", 1), ("type", 1), ("ignoredAt", 1), ("createdAt", -1)]
    )
    await db.communications.create_index(
        [("userId", 1), ("type", 1), ("clientId", 1), ("createdAt", -1)]
    )

    # Search V2 helpers (regex still limited; compound filters + sort)
    await db.clients.create_index([("userId", 1), ("emails.value", 1)])
    await db.clients.create_index([("userId", 1), ("phones.value", 1)])
    await db.clients.create_index([("userId", 1), ("siret", 1)])
    await db.clients.create_index([("userId", 1), ("city", 1)])

    # Memory Intelligence snapshot cache
    await ensure_index(
        db.memory_intelligence_snapshots,
        "userId",
        name="memory_intelligence_snapshots_user_unique",
        unique=True,
    )

    await db.credit_plans.create_index("id", unique=True)
    await db.credit_costs.create_index("actionKey", unique=True)
    await db.user_credit_accounts.create_index("id", unique=True)
    await db.user_credit_accounts.create_index("userId", unique=True)
    await db.credit_transactions.create_index("id", unique=True)
    await db.credit_transactions.create_index([("userId", 1), ("createdAt", -1)])
    await db.credit_transactions.create_index([("userId", 1), ("type", 1), ("createdAt", -1)])
    await drop_index_if_exists(db.credit_transactions, "userId_1_idempotencyKey_1")
    await ensure_index(
        db.credit_transactions,
        [("userId", 1), ("idempotencyKey", 1)],
        name="credit_tx_user_idempotency_unique",
        unique=True,
        partialFilterExpression={"idempotencyKey": {"$exists": True}},
    )

    from credit_pack_service import dedupe_credit_packs

    await dedupe_credit_packs(db)
    await drop_index_if_exists(db.credit_packs, "id_1")
    await drop_index_if_exists(db.credit_packs, "packKey_1")
    await ensure_index(db.credit_packs, "id", name="credit_packs_id_unique", unique=True)
    await ensure_index(
        db.credit_packs,
        "packKey",
        name="credit_packs_pack_key_unique",
        unique=True,
    )
    await drop_index_if_exists(db.credit_purchases, "id_1")
    await ensure_index(db.credit_purchases, "id", name="credit_purchases_id_unique", unique=True)
    await db.credit_purchases.create_index([("userId", 1), ("createdAt", -1)])
    await ensure_index(
        db.credit_purchases,
        [("userId", 1), ("idempotencyKey", 1)],
        name="credit_purchase_user_idempotency_unique",
        unique=True,
        partialFilterExpression={"idempotencyKey": {"$exists": True}},
    )

    await db.user_subscriptions.create_index("id", unique=True)
    await db.user_subscriptions.create_index("userId", unique=True)
    await db.user_subscriptions.create_index([("status", 1), ("currentPeriodEnd", 1)])
    await db.subscription_history.create_index("id", unique=True)
    await db.subscription_history.create_index([("userId", 1), ("createdAt", -1)])
    await db.subscription_history.create_index([("subscriptionId", 1), ("createdAt", -1)])
    await drop_index_if_exists(db.subscription_history, "userId_1_idempotencyKey_1")
    await ensure_index(
        db.subscription_history,
        [("userId", 1), ("idempotencyKey", 1)],
        name="sub_hist_user_idempotency_unique",
        unique=True,
        partialFilterExpression={"idempotencyKey": {"$exists": True}},
    )

    await ensure_index(db.stripe_events, "eventId", name="stripe_events_event_id_unique", unique=True)
    await db.stripe_events.create_index([("userId", 1), ("processedAt", -1)], sparse=True)
    await db.user_subscriptions.create_index("stripeSubscriptionId", unique=True, sparse=True)

    await db.email_events.create_index("id", unique=True)
    await ensure_index(
        db.email_events,
        "idempotencyKey",
        name="email_events_idempotency_unique",
        unique=True,
        partialFilterExpression={"idempotencyKey": {"$exists": True}},
    )
    await db.email_events.create_index([("userId", 1), ("createdAt", -1)], sparse=True)
    await db.email_events.create_index([("status", 1), ("nextRetryAt", 1)])
    await db.email_events.create_index([("status", 1), ("updatedAt", -1)])
    await db.email_events.create_index([("createdAt", -1)])

    from admin_constants import COLLECTION_AI_USAGE_EVENTS, COLLECTION_ADMIN_AUDIT_LOGS

    await db[COLLECTION_AI_USAGE_EVENTS].create_index("id", unique=True)
    await ensure_index(
        db[COLLECTION_AI_USAGE_EVENTS],
        "idempotencyKey",
        name="ai_usage_idempotency_unique",
        unique=True,
        partialFilterExpression={"idempotencyKey": {"$exists": True}},
    )
    await db[COLLECTION_AI_USAGE_EVENTS].create_index([("userId", 1), ("createdAt", -1)])
    await db[COLLECTION_AI_USAGE_EVENTS].create_index([("createdAt", -1)])
    await db[COLLECTION_AI_USAGE_EVENTS].create_index([("actionKey", 1), ("createdAt", -1)])

    await db[COLLECTION_ADMIN_AUDIT_LOGS].create_index("id", unique=True)
    await db[COLLECTION_ADMIN_AUDIT_LOGS].create_index([("createdAt", -1)])
    await db[COLLECTION_ADMIN_AUDIT_LOGS].create_index([("adminUserId", 1), ("createdAt", -1)])

    await db.users.create_index([("role", 1)], sparse=True)
    await db.users.create_index([("accountStatus", 1)], sparse=True)
    await db.events.create_index([("createdAt", -1)])
    await db.stripe_events.create_index([("status", 1), ("createdAt", -1)])

    await ensure_index(db.connected_accounts, "id", name="connected_accounts_id_unique", unique=True)
    await ensure_index(
        db.connected_accounts,
        [("userId", 1), ("provider", 1)],
        name="connected_accounts_user_provider_unique",
        unique=True,
    )
    await db.connected_accounts.create_index([("userId", 1), ("updatedAt", -1)])

    await ensure_index(db.beta_feedback, "id", name="beta_feedback_id_unique", unique=True)
    await ensure_index(
        db.beta_feedback,
        [("userId", 1), ("createdAt", -1)],
        name="beta_feedback_user_created",
    )

    await seed_credit_catalog(db)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()