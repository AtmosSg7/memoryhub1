"""Gmail API provider — read-only OAuth + message metadata + history sync."""

from __future__ import annotations

import re
from email.utils import parseaddr, parsedate_to_datetime
from typing import Any, Dict, List, Optional

import httpx

from integrations.config import gmail_scopes
from integrations.constants import (
    GMAIL_HISTORY_MAX_MESSAGE_IDS,
    GMAIL_HISTORY_MAX_PAGES,
    GMAIL_HISTORY_PAGE_SIZE,
    GMAIL_SYNC_MAX_MESSAGES,
    PROVIDER_GMAIL,
)
from integrations.email_provider import EmailProvider
from integrations.gmail_errors import GmailApiError, GmailHistoryExpiredError, is_history_expired_response
from integrations.models import (
    GmailHistoryResult,
    GmailMailboxProfile,
    RemoteEmailAttachment,
    RemoteEmailMessage,
)
from integrations.providers.google_oauth import (
    build_google_authorize_url,
    exchange_google_code,
    refresh_google_access_token,
    revoke_google_token,
)

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
_METADATA_HEADERS = ["From", "To", "Cc", "Subject", "Date"]


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


def _auth_headers(access_token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


async def _fetch_message_detail(
    client: httpx.AsyncClient,
    *,
    access_token: str,
    message_id: str,
    account_email: Optional[str],
) -> Optional[RemoteEmailMessage]:
    detail = await client.get(
        f"{GMAIL_API}/messages/{message_id}",
        params={
            "format": "metadata",
            "metadataHeaders": _METADATA_HEADERS,
        },
        headers=_auth_headers(access_token),
    )
    if detail.status_code == 404:
        return None
    detail.raise_for_status()
    return parse_gmail_message(detail.json(), account_email=account_email)


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

    async def get_mailbox_profile(self, *, access_token: str) -> GmailMailboxProfile:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(
                f"{GMAIL_API}/profile",
                headers=_auth_headers(access_token),
            )
            if res.status_code != 200:
                raise GmailApiError(
                    "Unable to read Gmail mailbox profile.",
                    status_code=res.status_code,
                )
            payload = res.json()
            history_id = payload.get("historyId")
            return GmailMailboxProfile(
                emailAddress=(payload.get("emailAddress") or "").strip().lower() or None,
                historyId=str(history_id) if history_id is not None else None,
                messagesTotal=int(payload["messagesTotal"])
                if payload.get("messagesTotal") is not None
                else None,
            )

    async def list_history_message_ids(
        self,
        *,
        access_token: str,
        start_history_id: str,
        max_message_ids: int = GMAIL_HISTORY_MAX_MESSAGE_IDS,
    ) -> GmailHistoryResult:
        start = str(start_history_id or "").strip()
        if not start:
            raise GmailHistoryExpiredError("Missing Gmail history cursor.")

        message_ids: List[str] = []
        seen = set()
        page_token = None
        pages = 0
        latest_history_id: Optional[str] = None
        max_ids = max(1, min(int(max_message_ids), GMAIL_HISTORY_MAX_MESSAGE_IDS))

        async with httpx.AsyncClient(timeout=45.0) as client:
            while pages < GMAIL_HISTORY_MAX_PAGES and len(message_ids) < max_ids:
                params: Dict[str, Any] = {
                    "startHistoryId": start,
                    "maxResults": min(GMAIL_HISTORY_PAGE_SIZE, max_ids - len(message_ids)),
                    # Prefer message additions (not pure label noise).
                    "historyTypes": "messageAdded",
                }
                if page_token:
                    params["pageToken"] = page_token
                res = await client.get(
                    f"{GMAIL_API}/history",
                    params=params,
                    headers=_auth_headers(access_token),
                )
                if is_history_expired_response(res):
                    raise GmailHistoryExpiredError("Gmail history cursor expired.")
                if res.status_code >= 400:
                    raise GmailApiError(
                        "Gmail history list failed.",
                        status_code=res.status_code,
                    )
                payload = res.json()
                pages += 1
                if payload.get("historyId") is not None:
                    latest_history_id = str(payload.get("historyId"))

                for entry in payload.get("history") or []:
                    for added in entry.get("messagesAdded") or []:
                        msg = (added or {}).get("message") or {}
                        mid = (msg.get("id") or "").strip()
                        if mid and mid not in seen:
                            seen.add(mid)
                            message_ids.append(mid)
                            if len(message_ids) >= max_ids:
                                break
                    if len(message_ids) >= max_ids:
                        break

                page_token = payload.get("nextPageToken")
                if not page_token:
                    break

        return GmailHistoryResult(
            messageIds=message_ids,
            historyId=latest_history_id,
            pages=pages,
        )

    async def fetch_messages_by_ids(
        self,
        *,
        access_token: str,
        message_ids: List[str],
        account_email: Optional[str] = None,
    ) -> List[RemoteEmailMessage]:
        if not message_ids:
            return []
        resolved_email = account_email
        messages: List[RemoteEmailMessage] = []
        async with httpx.AsyncClient(timeout=45.0) as client:
            if not resolved_email:
                profile = await self.get_mailbox_profile(access_token=access_token)
                resolved_email = profile.emailAddress
            for mid in message_ids:
                parsed = await _fetch_message_detail(
                    client,
                    access_token=access_token,
                    message_id=mid,
                    account_email=resolved_email,
                )
                if parsed:
                    messages.append(parsed)
        return messages

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
                headers=_auth_headers(access_token),
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
                    headers=_auth_headers(access_token),
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
                parsed = await _fetch_message_detail(
                    client,
                    access_token=access_token,
                    message_id=mid,
                    account_email=account_email,
                )
                if parsed:
                    messages.append(parsed)
        return messages

    async def count_messages(self, *, access_token: str) -> int:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(
                f"{GMAIL_API}/messages",
                params={"maxResults": 1},
                headers=_auth_headers(access_token),
            )
            res.raise_for_status()
            payload = res.json()
            estimate = payload.get("resultSizeEstimate")
            if estimate is not None:
                return int(estimate)
            return len(payload.get("messages") or [])
