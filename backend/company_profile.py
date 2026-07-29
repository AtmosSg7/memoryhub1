"""Company profile API."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.responses import FileResponse, Response

from auth import get_current_user, get_db
from company_profile_models import CompanyProfileResponse, CompanyProfileUpdate
from company_profile_service import (
    build_logo_api_url,
    get_company_profile,
    get_user_with_profile,
    store_company_logo,
    update_company_profile,
)

company_profile_router = APIRouter(prefix="/company-profile", tags=["company-profile"])


@company_profile_router.get("", response_model=CompanyProfileResponse)
async def read_company_profile(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user = await get_user_with_profile(db, current_user["id"])
    profile = await get_company_profile(db, current_user["id"])
    raw = user["companyProfile"]
    return CompanyProfileResponse(
        profile=profile,
        logoUrl=build_logo_api_url(raw.get("logoStorageKey")),
        pdfLogoUrl=build_logo_api_url(raw.get("pdfLogoStorageKey") or raw.get("logoStorageKey")),
    )


@company_profile_router.patch("", response_model=CompanyProfileResponse)
async def patch_company_profile(
    body: CompanyProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    await update_company_profile(db, current_user["id"], body)
    user = await get_user_with_profile(db, current_user["id"])
    profile = await get_company_profile(db, current_user["id"])
    raw = user["companyProfile"]
    return CompanyProfileResponse(
        profile=profile,
        logoUrl=build_logo_api_url(raw.get("logoStorageKey")),
        pdfLogoUrl=build_logo_api_url(raw.get("pdfLogoStorageKey") or raw.get("logoStorageKey")),
    )


@company_profile_router.post("/logo", response_model=CompanyProfileResponse)
async def upload_company_logo(
    file: UploadFile = File(...),
    kind: Literal["logo", "pdf"] = "logo",
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    await store_company_logo(db, current_user["id"], file, kind=kind)
    user = await get_user_with_profile(db, current_user["id"])
    profile = await get_company_profile(db, current_user["id"])
    raw = user["companyProfile"]
    return CompanyProfileResponse(
        profile=profile,
        logoUrl=build_logo_api_url(raw.get("logoStorageKey")),
        pdfLogoUrl=build_logo_api_url(raw.get("pdfLogoStorageKey") or raw.get("logoStorageKey")),
    )


@company_profile_router.get("/assets/{storage_key:path}")
async def get_company_logo_asset(
    storage_key: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    user = await get_user_with_profile(db, current_user["id"])
    profile = user["companyProfile"]
    allowed = {
        profile.get("logoStorageKey"),
        profile.get("pdfLogoStorageKey"),
    }
    if storage_key not in allowed:
        raise HTTPException(status_code=404, detail={"message": "Asset not found."})

    from storage import get_storage

    storage = get_storage()
    try:
        path = await storage.get_path(storage_key)
    except Exception:
        raise HTTPException(status_code=404, detail={"message": "Asset not found."})
    return FileResponse(path)
