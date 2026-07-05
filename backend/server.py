import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)

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

# Configure logging early — used by route handlers
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()
app.state.db = db

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

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

@api_router.post("/waitlist", response_model=WaitlistResponse, status_code=201)
async def join_waitlist(input: WaitlistCreate):
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
api_router.include_router(imports_router)
api_router.include_router(catalog_router)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_indexes():
    await db.waitlist.create_index("email", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("emailVerificationToken", sparse=True)
    await db.users.create_index("passwordResetToken", sparse=True)
    await db.clients.create_index("id", unique=True)
    await db.clients.create_index([("userId", 1), ("updatedAt", -1)])
    await db.clients.create_index([("userId", 1), ("status", 1)])
    await db.notes.create_index("id", unique=True)
    await db.notes.create_index([("userId", 1), ("updatedAt", -1)])
    await db.notes.create_index([("userId", 1), ("clientId", 1), ("updatedAt", -1)])
    await db.notes.create_index([("userId", 1), ("noteDate", -1)])
    await db.notes.create_index([("userId", 1), ("clientId", 1), ("noteDate", -1)])
    await db.notes.create_index([("userId", 1), ("type", 1), ("noteDate", -1)])
    await db.documents.create_index("id", unique=True)
    await db.documents.create_index([("userId", 1), ("updatedAt", -1)])
    await db.documents.create_index([("userId", 1), ("clientId", 1), ("updatedAt", -1)])
    await db.events.create_index("id", unique=True)
    await db.events.create_index([("userId", 1), ("createdAt", -1)])
    await db.events.create_index([("userId", 1), ("clientId", 1), ("createdAt", -1)])
    await db.quotes.create_index("id", unique=True)
    await db.quotes.create_index([("userId", 1), ("number", 1)], unique=True)
    await db.quotes.create_index([("userId", 1), ("quoteDate", -1)])
    await db.quotes.create_index([("userId", 1), ("clientId", 1), ("quoteDate", -1)])
    await db.quotes.create_index([("userId", 1), ("status", 1), ("quoteDate", -1)])
    await db.invoices.create_index("id", unique=True)
    await db.invoices.create_index([("userId", 1), ("number", 1)], unique=True)
    await db.invoices.create_index([("userId", 1), ("invoiceDate", -1)])
    await db.invoices.create_index([("userId", 1), ("clientId", 1), ("invoiceDate", -1)])
    await db.invoices.create_index([("userId", 1), ("status", 1), ("invoiceDate", -1)])
    await db.import_sessions.create_index("id", unique=True)
    await db.import_sessions.create_index([("userId", 1), ("createdAt", -1)])
    await db.import_sessions.create_index([("userId", 1), ("status", 1), ("createdAt", -1)])
    await db.quotes.create_index([("userId", 1), ("clientId", 1), ("externalNumber", 1)], sparse=True)
    await db.invoices.create_index([("userId", 1), ("clientId", 1), ("externalNumber", 1)], sparse=True)
    await db.catalog_items.create_index("id", unique=True)
    await db.catalog_items.create_index([("userId", 1), ("normalizedKey", 1)], unique=True)
    await db.catalog_items.create_index([("userId", 1), ("lastUsedAt", -1)])
    await db.catalog_items.create_index([("userId", 1), ("usageCount", -1)])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()