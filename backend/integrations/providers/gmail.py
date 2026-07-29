"""Gmail API provider — read-only OAuth + message metadata fetch."""

from __future__ import annotations

import re
from email.utils import parseaddr, parsedate_to_datetime
from typing import Any, Dict, List, Optional

import httpx

from integrations.config import gmail_scopes
from integrations.constants import GMAIL_SYNC_MAX_MESSAGES, PROVIDER_GMAIL
from integrations.email_provider import EmailProvider
from integrations.models import RemoteEmailAttachment, RemoteEmailMessage
from integrations.providers.google_oauth import (
    build_google_authorize_url,
    exchange_google_code,
    refresh_google_access_token,
    revoke_google_token,
)

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"


def _header_map(payload: Dict[str, Any]) -> Dict[str, str]:
    headers = {}
    for item in (payload or {}).get("headers") or []:
        name = (item.get("name") or "").strip().lower()
        if name:
            headers[name] = item.get("value") or ""
    return headers


def _parse_address_list(raw: str) -> List[str]:
    if not raw:
        return []
    parts = re.split(r",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", raw)
    emails = []
    for part in parts:
        _, addr = parseaddr(part.strip())
        if addr:
            emails.append(addr.strip().lower())
    return emails


def _collect_attachments(payload: Optional[Dict[str, Any]]) -> List[RemoteEmailAttachment]:
    attachments: List[RemoteEmailAttachment] = []
    if not payload:
        return attachments

    def walk(node: Dict[str, Any]) -> None:
        filename = (node.get("filename") or "").strip()
        body = node.get("body") or {}
        mime = (node.get("mimeType") or "").strip() or None
        size = body.get("size")
        if filename or body.get("attachmentId"):
            attachments.append(
                RemoteEmailAttachment(
                    filename=filename or None,
                    mimeType=mime,
                    size=int(size) if size is not None else None,
                )
            )
        for child in node.get("parts") or []:
            if isinstance(child, dict):
                walk(child)

    walk(payload)
    # Drop empty placeholders (inline body parts without filename)
    return [a for a in attachments if a.filename or (a.size and a.size > 0)]


def _parse_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        return dt.isoformat()
    except Exception:
        return value


def _gmail_web_link(thread_id: Optional[str], message_id: str) -> str:
    if thread_id:
        return f"https://mail.google.com/mail/u/0/#inbox/{thread_id}"
    return f"https://mail.google.com/mail/u/0/#all/{message_id}"


def parse_gmail_message(raw: Dict[str, Any], *, account_email: Optional[str] = None) -> Optional[RemoteEmailMessage]:
    msg_id = (raw.get("id") or "").strip()
    if not msg_id:
        return None
    payload = raw.get("payload") or {}
    headers = _header_map(payload)
    from_name, from_email = parseaddr(headers.get("from") or "")
    to_emails = _parse_address_list(headers.get("to") or "")
    cc_emails = _parse_address_list(headers.get("cc") or "")
    account = (account_email or "").strip().lower()
    from_norm = (from_email or "").strip().lower()
    if account and from_norm == account:
        direction = "outbound"
    else:
        direction = "inbound"

    thread_id = (raw.get("threadId") or "").strip() or None
    return RemoteEmailMessage(
        sourceId=msg_id,
        threadId=thread_id,
        subject=(headers.get("subject") or "").strip() or None,
        snippet=(raw.get("snippet") or "").strip() or None,
        fromEmail=from_norm or None,
        fromName=(from_name or "").strip() or None,
        toEmails=to_emails,
        ccEmails=cc_emails,
        direction=direction,  # type: ignore[arg-type]
        sentAt=_parse_date(headers.get("date")),
        webLink=_gmail_web_link(thread_id, msg_id),
        attachments=_collect_attachments(payload),
        raw={"id": msg_id, "threadId": thread_id, "labelIds": raw.get("labelIds") or []},
    )


class GmailProvider(EmailProvider):
    provider_key = PROVIDER_GMAIL

    def build_authorize_url(self, *, state: str, redirect_uri: str) -> str:
        return build_google_authorize_url(
            state=state,
            redirect_uri=redirect_uri,
            scopes=gmail_scopes(),
        )

    async def exchange_code(self, *, code: str, redirect_uri: str) -> dict:
        return await exchange_google_code(
            code=code,
            redirect_uri=redirect_uri,
            default_scope=" ".join(gmail_scopes()),
        )

    async def refresh_access_token(self, *, refresh_token: str) -> dict:
        return await refresh_google_access_token(refresh_token=refresh_token)

    async def revoke_token(self, *, token: str) -> None:
        await revoke_google_token(token=token)

    async def list_messages(
        self,
        *,
        access_token: str,
        max_results: int = GMAIL_SYNC_MAX_MESSAGES,
    ) -> List[RemoteEmailMessage]:
        account_email = None
        messages: List[RemoteEmailMessage] = []
        async with httpx.AsyncClient(timeout=45.0) as client:
            profile = await client.get(
                f"{GMAIL_API}/profile",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if profile.status_code == 200:
                account_email = (profile.json().get("emailAddress") or "").strip().lower() or None

            listed_ids: List[str] = []
            page_token = None
            remaining = max(1, min(int(max_results), GMAIL_SYNC_MAX_MESSAGES))
            while remaining > 0:
                page_size = min(50, remaining)
                params: Dict[str, Any] = {"maxResults": page_size}
                if page_token:
                    params["pageToken"] = page_token
                res = await client.get(
                    f"{GMAIL_API}/messages",
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                res.raise_for_status()
                payload = res.json()
                for item in payload.get("messages") or []:
                    mid = (item.get("id") or "").strip()
                    if mid:
                        listed_ids.append(mid)
                remaining = max_results - len(listed_ids)
                page_token = payload.get("nextPageToken")
                if not page_token or len(listed_ids) >= max_results:
                    break

            for mid in listed_ids[:max_results]:
                detail = await client.get(
                    f"{GMAIL_API}/messages/{mid}",
                    params={
                        "format": "metadata",
                        "metadataHeaders": ["From", "To", "Cc", "Subject", "Date"],
                    },
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                detail.raise_for_status()
                parsed = parse_gmail_message(detail.json(), account_email=account_email)
                if parsed:
                    messages.append(parsed)
        return messages

    async def count_messages(self, *, access_token: str) -> int:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(
                f"{GMAIL_API}/messages",
                params={"maxResults": 1},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            res.raise_for_status()
            payload = res.json()
            # Gmail list does not always return resultSizeEstimate for all queries
            estimate = payload.get("resultSizeEstimate")
            if estimate is not None:
                return int(estimate)
            return len(payload.get("messages") or [])
