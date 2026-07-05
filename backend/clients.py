import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from auth import get_current_user, get_db
from events import record_event

clients_router = APIRouter(prefix="/clients", tags=["clients"])

ClientStatus = Literal["active", "pending", "new", "dormant"]

CLIENT_PROJECTION = {"_id": 0, "userId": 0}


class ClientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    contactName: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=200)
    activity: Optional[str] = Field(None, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=200)
    status: ClientStatus = "new"
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be empty.")
        return stripped


class ClientUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    contactName: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=200)
    activity: Optional[str] = Field(None, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=200)
    status: Optional[ClientStatus] = None
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be empty.")
        return stripped


class ClientPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    contactName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    activity: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    status: ClientStatus = "new"
    notes: Optional[str] = None
    createdAt: str
    updatedAt: str


class ClientListResponse(BaseModel):
    items: List[ClientPublic]
    total: int


def client_public(doc: dict) -> ClientPublic:
    return ClientPublic(
        id=doc["id"],
        name=doc["name"],
        contactName=doc.get("contactName"),
        email=doc.get("email"),
        phone=doc.get("phone"),
        company=doc.get("company"),
        activity=doc.get("activity"),
        address=doc.get("address"),
        city=doc.get("city"),
        status=doc.get("status", "new"),
        notes=doc.get("notes"),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


def _client_display_name(client: dict) -> str:
    company = (client.get("company") or "").strip()
    if company:
        return company
    return client["name"]


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


@clients_router.post("", response_model=ClientPublic, status_code=201)
async def create_client(
    body: ClientCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "userId": current_user["id"],
        "name": body.name,
        "contactName": body.contactName,
        "email": str(body.email) if body.email else None,
        "phone": body.phone,
        "company": body.company,
        "activity": body.activity,
        "address": body.address,
        "city": body.city,
        "status": body.status,
        "notes": body.notes,
        "createdAt": now,
        "updatedAt": now,
    }
    await db.clients.insert_one(doc)
    await record_event(
        db,
        current_user["id"],
        "client_created",
        "client",
        doc["id"],
        client_id=doc["id"],
        metadata={"clientName": _client_display_name(doc)},
    )
    return client_public(doc)


@clients_router.get("", response_model=ClientListResponse)
async def list_clients(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = _user_filter(current_user["id"])
    total = await db.clients.count_documents(query)
    cursor = db.clients.find(query, CLIENT_PROJECTION).sort("updatedAt", -1)
    items = [client_public(doc) async for doc in cursor]
    return ClientListResponse(items=items, total=total)


@clients_router.get("/recent", response_model=List[ClientPublic])
async def recent_clients(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    query = _user_filter(current_user["id"])
    cursor = (
        db.clients.find(query, CLIENT_PROJECTION)
        .sort("updatedAt", -1)
        .limit(5)
    )
    return [client_public(doc) async for doc in cursor]


@clients_router.get("/{client_id}", response_model=ClientPublic)
async def get_client(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await db.clients.find_one(
        {**_user_filter(current_user["id"]), "id": client_id},
        CLIENT_PROJECTION,
    )
    if not doc:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})
    return client_public(doc)


@clients_router.put("/{client_id}", response_model=ClientPublic)
async def update_client(
    client_id: str,
    body: ClientUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    existing = await db.clients.find_one(
        {**_user_filter(current_user["id"]), "id": client_id},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return client_public(existing)

    if "email" in updates and updates["email"] is not None:
        updates["email"] = str(updates["email"])

    merged = {**existing, **updates}
    merged["updatedAt"] = datetime.now(timezone.utc).isoformat()

    await db.clients.update_one(
        {"userId": current_user["id"], "id": client_id},
        {"$set": {k: merged[k] for k in merged if k not in ("id", "userId", "createdAt")}},
    )

    if "company" in updates or "name" in updates:
        display_name = _client_display_name(merged)
        await db.notes.update_many(
            {"userId": current_user["id"], "clientId": client_id},
            {"$set": {"clientName": display_name}},
        )
        await db.documents.update_many(
            {"userId": current_user["id"], "clientId": client_id},
            {"$set": {"clientName": display_name}},
        )
        await db.quotes.update_many(
            {"userId": current_user["id"], "clientId": client_id},
            {"$set": {"clientName": display_name}},
        )
        await db.invoices.update_many(
            {"userId": current_user["id"], "clientId": client_id},
            {"$set": {"clientName": display_name}},
        )

    await record_event(
        db,
        current_user["id"],
        "client_updated",
        "client",
        client_id,
        client_id=client_id,
        metadata={"clientName": _client_display_name(merged)},
    )

    public_doc = {k: v for k, v in merged.items() if k not in ("userId", "_id")}
    return client_public(public_doc)


@clients_router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user_id = current_user["id"]
    existing = await db.clients.find_one(
        {**_user_filter(user_id), "id": client_id},
        {"_id": 1},
    )
    if not existing:
        raise HTTPException(status_code=404, detail={"message": "Client not found."})

    linked_notes = await db.notes.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    linked_documents = await db.documents.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    linked_quotes = await db.quotes.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    linked_invoices = await db.invoices.count_documents(
        {"userId": user_id, "clientId": client_id}
    )
    if linked_notes > 0 or linked_documents > 0 or linked_quotes > 0 or linked_invoices > 0:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "Impossible de supprimer ce client car il possède des notes, "
                    "des documents, des devis ou des factures liés."
                )
            },
        )

    await db.clients.delete_one({**_user_filter(user_id), "id": client_id})
