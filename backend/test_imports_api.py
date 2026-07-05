"""Manual integration test for import API endpoints."""

import json
import sys
from http.cookiejar import CookieJar
from pathlib import Path
from urllib import request

BASE = "http://localhost:8000"


def api_call(method, path, cookie_jar, payload=None, files=None):
    headers = {}
    data = None
    if files:
        boundary = "----MemoryHubTestBoundary"
        body_parts = []
        for name, (filename, content, mime) in files.items():
            body_parts.append(f"--{boundary}\r\n".encode())
            body_parts.append(
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
            )
            body_parts.append(f"Content-Type: {mime}\r\n\r\n".encode())
            body_parts.append(content)
            body_parts.append(b"\r\n")
        body_parts.append(f"--{boundary}--\r\n".encode())
        data = b"".join(body_parts)
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"

    req = request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    opener = request.build_opener(request.HTTPCookieProcessor(cookie_jar))
    try:
        with opener.open(req) as resp:
            body = resp.read().decode()
            return resp.status, json.loads(body) if body else None
    except request.HTTPError as err:
        body = err.read().decode()
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"raw": body}
        return err.code, parsed


def main():
    email = sys.argv[1] if len(sys.argv) > 1 else "demo@memoryhub.fr"
    password = sys.argv[2] if len(sys.argv) > 2 else "password123"
    jar = CookieJar()

    status, body = api_call(
        "POST",
        "/api/auth/login",
        jar,
        {"email": email, "password": password},
    )
    print("login:", status, body.get("message") if body else body)
    if status != 200:
        return 1

    pdf_bytes = b"%PDF-1.4 mock devis test\n"
    status, session = api_call(
        "POST",
        "/api/imports/analyze",
        jar,
        files={"file": ("devis-test.pdf", pdf_bytes, "application/pdf")},
    )
    print("analyze:", status, session.get("id") if session else session)
    if status != 201:
        return 1

    session_id = session["id"]
    status, fetched = api_call("GET", f"/api/imports/{session_id}", jar)
    print("get:", status, fetched.get("status") if fetched else fetched)
    if status != 200 or fetched.get("status") != "pending":
        return 1

    normalized = session["analysis"]["normalized"]
    confirm_payload = {
        "targetKind": session["detectedKind"],
        "clientAction": "create_new",
        "clientData": {
            "name": normalized.get("clientName") or "Client Import Test",
            "company": normalized.get("company"),
            "email": normalized.get("email"),
            "phone": normalized.get("phone"),
            "address": normalized.get("address"),
            "city": normalized.get("city"),
        },
        "fields": normalized,
    }
    status, confirmed = api_call(
        "POST",
        f"/api/imports/{session_id}/confirm",
        jar,
        confirm_payload,
    )
    print("confirm:", status, confirmed.get("created") if confirmed else confirmed)
    if status != 200:
        return 1

    status, again = api_call(
        "POST",
        f"/api/imports/{session_id}/confirm",
        jar,
        confirm_payload,
    )
    print("confirm-idempotent:", status, again.get("created", {}).get("entityId") if again else again)

    status, listing = api_call("GET", "/api/imports?limit=5", jar)
    print("list:", status, listing.get("total") if listing else listing)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
