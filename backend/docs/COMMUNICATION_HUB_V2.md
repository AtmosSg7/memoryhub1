# Communication Hub V2

Multi-channel conversation layer on top of the existing Communication Center.

## Architecture

```
Provider (Gmail today · Phone/WhatsApp stubs)
        │
        ▼
communications  ──hook──►  conversations  +  communication_attachments
        │                         │
        ├─ Timeline V2            ├─ Client Inbox API
        ├─ Prospects              └─ Search group `conversations`
        ├─ Action Engine
        └─ Communication Intelligence
```

- **No parallel store for messages** — `communications` remains the canonical message row.
- **Conversations** group messages by channel-specific keys (Gmail `threadId`, phone identity, WA thread).
- **Lifecycle** (`new|to_read|read|replied|waiting|archived|ignored`) is independent from association (`linked|unlinked|ignored`).
- **Attachments** are metadata rows linked to conversation + communication (binary storage stays provider-side for now).

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/hub/providers` | Provider readiness |
| GET | `/api/hub/conversations` | List conversations |
| GET | `/api/hub/conversations/{id}` | Thread + messages + attachments |
| GET | `/api/hub/clients/{id}/inbox` | Client inbox by channel |
| PATCH | `/api/hub/communications/{id}/lifecycle` | Lifecycle transition |
| POST | `/api/hub/migrate` | Idempotent backfill for current user |

## Progressive migration

On each Gmail upsert, `after_communication_upsert` attaches `conversationId` / lifecycle.
`POST /api/hub/migrate` backfills older rows without downtime.

## Reserved providers

- `PhoneProvider` — conversation / event / identity / timeline shapes ready
- `WhatsAppProvider` — same
- Live sync raises `NotImplementedError` until a real connector is wired

## Timeline vs Inbox

- **Timeline V2** = one synthetic card per conversation (latest message + `messageCount`)
- **Client Inbox detail** = individual messages of the thread
- Commercial / notes / documents / actions stay as discrete ledger events

## Lifecycle rules

| Event | Lifecycle |
|-------|-----------|
| Inbound ingest | `to_read` |
| Outbound ingest | `replied` |
| Open conversation (`markRead=true`) | inbound `new`/`to_read` → `read` |
| Manual PATCH | any allowed transition |
| Association ignore/link | **does not** change lifecycle |

Conversation lifecycle is recomputed from member messages (`to_read` wins if any unread inbound).

## Production migration

```bash
cd backend
# dry-run
.venv/Scripts/python.exe scripts/migrate_communication_hub.py --user-id USER_ID --dry-run
# apply (idempotent)
.venv/Scripts/python.exe scripts/migrate_communication_hub.py --user-id USER_ID --limit 5000
# or per authenticated user
curl -X POST "$API/api/hub/migrate?limit=2000" -H "Authorization: Bearer $TOKEN"
```

No new env vars. Rollback without message loss: drop/ignore `conversations` + `communication_attachments`; clear optional `conversationId`/`lifecycleStatus` on communications if needed. Messages remain in `communications`.

## Remaining limits

- Attachment binaries stay provider-side (Gmail `format=metadata`); Hub stores metadata only
- Phone / WhatsApp / SMS / Calendar are architectural stubs (`ready=false`)
- Existing rows need migrate / re-sync before they appear in Client Inbox
- Association status (`linked|unlinked|ignored`) remains separate from lifecycle
- Client Emails flat list API (`email_messages`) is unchanged for compatibility
- Full-body search across message content is not enabled (preview / subject / participants / attachments)
- Unlinked conversation deep-link on Communications page is still thin (client-linked path is complete)
