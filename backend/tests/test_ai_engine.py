"""AI usage events, history, and import credit integration tests."""

import asyncio
import io
import os
import uuid

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "memoryhub_test")
os.environ["ANALYZER_PROVIDER"] = "mock"

_mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _mongo[os.environ["DB_NAME"]]
_loop = asyncio.new_event_loop()


@pytest.fixture(autouse=True)
def _credits_enforced(monkeypatch):
    monkeypatch.setenv("CREDITS_ENFORCED", "true")


def _run(coro):
    return _loop.run_until_complete(coro)


from credit_seed import seed_credit_catalog  # noqa: E402

_run(seed_credit_catalog(_db))

from ai_usage_event_service import record_import_ai_usage  # noqa: E402
from ai_usage_history_service import list_user_ai_usage  # noqa: E402
from credit_service import grant_monthly_credits  # noqa: E402
from import_service import analyze_import_file, estimate_import_file  # noqa: E402


class FakeUpload:
    def __init__(self, filename: str, content: bytes, content_type: str):
        self.filename = filename
        self.content_type = content_type
        self._content = content

    async def read(self):
        return self._content


def _user_id() -> str:
    return str(uuid.uuid4())


def test_record_import_ai_usage_includes_credits():
    user_id = _user_id()
    session_id = str(uuid.uuid4())
    doc = _run(
        record_import_ai_usage(
            _db,
            user_id=user_id,
            session_id=session_id,
            model="mock-analyzer",
            token_usage={"inputTokens": 100, "outputTokens": 50, "totalTokens": 150},
            duration_ms=1200,
            success=True,
            tier_key="standard",
            document_type="pdf",
            credits_consumed=12,
            credit_transaction_id="tx-123",
            metadata={"detectedKind": "quote"},
        )
    )
    assert doc["creditsConsumed"] == 12
    assert doc["creditTransactionId"] == "tx-123"
    assert doc["tierKey"] == "standard"
    assert doc["documentType"] == "pdf"
    assert doc["inputTokens"] == 100


def test_list_user_ai_usage():
    user_id = _user_id()
    session_id = str(uuid.uuid4())
    _run(
        record_import_ai_usage(
            _db,
            user_id=user_id,
            session_id=session_id,
            model="mock-analyzer",
            token_usage={"inputTokens": 10, "outputTokens": 5, "totalTokens": 15},
            duration_ms=500,
            success=True,
            credits_consumed=8,
            tier_key="simple",
            document_type="jpg",
        )
    )
    items, total = _run(list_user_ai_usage(_db, user_id))
    assert total >= 1
    assert items[0]["analysesConsumed"] == 1


def test_estimate_import_file_api_shape():
    result = _run(
        estimate_import_file(
            _db,
            extension="pdf",
            size_bytes=600_000,
        )
    )
    assert result["actionKey"] == "IMPORT_DOCUMENT"
    assert result["estimatedAnalyses"] == 1
    assert "tierKey" in result


def test_analyze_import_debits_flat_analysis_credit():
    user_id = _user_id()
    _run(grant_monthly_credits(_db, user_id, "solo"))
    before = _run(_db.user_credit_accounts.find_one({"userId": user_id}))

    upload = FakeUpload(
        "devis-test.pdf",
        b"%PDF-1.4 sample content for import test " * 100,
        "application/pdf",
    )
    session = _run(analyze_import_file(_db, user_id, upload))
    assert session.detectedKind in {"quote", "invoice"}

    after = _run(_db.user_credit_accounts.find_one({"userId": user_id}))
    assert before["monthlyCreditsRemaining"] - after["monthlyCreditsRemaining"] == 50

    items, total = _run(list_user_ai_usage(_db, user_id, limit=5))
    assert total >= 1
    assert items[0]["success"] is True
    assert items[0]["analysesConsumed"] == 1
