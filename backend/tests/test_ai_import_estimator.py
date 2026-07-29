"""Tests for import credit estimation service."""

import asyncio
import os
import uuid

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "memoryhub_test")

_mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _mongo[os.environ["DB_NAME"]]
_loop = asyncio.new_event_loop()


def _run(coro):
    return _loop.run_until_complete(coro)


from credit_seed import seed_credit_catalog  # noqa: E402

_run(seed_credit_catalog(_db))

from ai_import_estimator import (  # noqa: E402
    ImportEstimateInput,
    estimate_import,
    estimate_pdf_page_count,
    resolve_import_tier,
)


def test_resolve_tier_simple_image():
    tier = resolve_import_tier(extension="jpg", size_bytes=200_000, page_count=1)
    assert tier == "simple"


def test_resolve_tier_complex_pdf():
    tier = resolve_import_tier(extension="pdf", size_bytes=2_000_000, page_count=8)
    assert tier == "complex"


def test_resolve_tier_very_complex_pdf():
    tier = resolve_import_tier(extension="pdf", size_bytes=5_000_000, page_count=15)
    assert tier == "very_complex"


def test_estimate_import_resolves_credits_from_db():
    result = _run(
        estimate_import(
            _db,
            ImportEstimateInput(extension="pdf", size_bytes=800_000),
        )
    )
    assert result.tier_key in {"simple", "standard", "complex", "very_complex"}
    assert result.estimated_credits >= 8
    assert result.page_count_estimate >= 1


def test_pdf_page_count_heuristic():
    fake_pdf = b"%PDF-1.4\n/Type /Pages\n/Count 5\n/Type /Page\n/Type /Page\n"
    assert estimate_pdf_page_count(fake_pdf) >= 2
