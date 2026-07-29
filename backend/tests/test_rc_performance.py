"""Release Candidate — performance smoke tests (single-user loaded dataset)."""

import time
import uuid

from tests.conftest import register_user


def _seed_bulk_data(client, user_suffix: str):
    register_user(client, suffix=user_suffix)
    client_ids = []
    for i in range(50):
        res = client.post(
            "/api/clients",
            json={"name": f"RC Client {user_suffix} {i:03d}", "status": "active"},
        )
        assert res.status_code in (200, 201)
        client_ids.append(res.json()["id"])

    for i in range(30):
        client.post(
            "/api/quotes",
            json={
                "clientId": client_ids[i % len(client_ids)],
                "title": f"RC Quote {i}",
                "amountHT": 10000 + i,
                "vatRate": 20,
                "status": "sent",
            },
        )
    for i in range(30):
        client.post(
            "/api/invoices",
            json={
                "clientId": client_ids[i % len(client_ids)],
                "title": f"RC Invoice {i}",
                "amountHT": 8000 + i,
                "vatRate": 20,
                "status": "sent",
            },
        )
    for i in range(40):
        client.post(
            "/api/notes",
            json={"content": f"RC note content {i}", "type": "general"},
        )


def test_dashboard_stats_under_threshold(client):
    suffix = uuid.uuid4().hex[:8]
    _seed_bulk_data(client, suffix)

    started = time.perf_counter()
    res = client.get("/api/dashboard/stats")
    elapsed = time.perf_counter() - started

    assert res.status_code == 200
    assert elapsed < 3.0, f"dashboard stats too slow: {elapsed:.2f}s"


def test_search_under_threshold(client):
    suffix = uuid.uuid4().hex[:8]
    _seed_bulk_data(client, suffix)

    started = time.perf_counter()
    res = client.get("/api/search", params={"q": f"RC Client {suffix}"})
    elapsed = time.perf_counter() - started

    assert res.status_code == 200
    assert res.json()["total"] >= 1
    assert elapsed < 3.0, f"search too slow: {elapsed:.2f}s"


def test_commercial_documents_list_under_threshold(client):
    suffix = uuid.uuid4().hex[:8]
    _seed_bulk_data(client, suffix)

    started = time.perf_counter()
    quotes = client.get("/api/quotes", params={"page": 1, "pageSize": 25})
    invoices = client.get("/api/invoices", params={"page": 1, "pageSize": 25})
    elapsed = time.perf_counter() - started

    assert quotes.status_code == 200
    assert invoices.status_code == 200
    assert elapsed < 4.0, f"commercial lists too slow: {elapsed:.2f}s"
