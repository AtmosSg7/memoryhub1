"""Dev-only demo data status — never registered in production/deployed builds."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user, get_db

DEV_DEMO_TAGS = ("demo_v1", "demo_v2")

dev_demo_router = APIRouter(prefix="/dev", tags=["dev"])


class DemoStatusResponse(BaseModel):
    hasDemoData: bool
    seedTag: Optional[str] = None


@dev_demo_router.get("/demo-status", response_model=DemoStatusResponse)
async def get_demo_status(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    doc = await db.clients.find_one(
        {"userId": current_user["id"], "devSeedTag": {"$in": list(DEV_DEMO_TAGS)}},
        {"_id": 0, "devSeedTag": 1},
    )
    if not doc:
        return DemoStatusResponse(hasDemoData=False)
    return DemoStatusResponse(hasDemoData=True, seedTag=doc.get("devSeedTag"))
