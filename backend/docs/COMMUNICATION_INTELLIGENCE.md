# Communication Intelligence

AI analysis layer for inbound communications. **Suggests only — the user decides.**

## Principles

- Never auto-creates clients, quotes, invoices, or emails
- Never creates Action Engine actions without explicit accept
- Never blocks Gmail sync on AI failure
- Channel-agnostic design; **Gmail / email only** in this version

## Feature flags

| Variable | Default | Role |
|----------|---------|------|
| `COMMUNICATION_INTELLIGENCE_ENABLED` | `false` | Master switch |
| `COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST` | `false` | Auto-analyze after upsert (off in prod by default) |
| `COMMUNICATION_INTELLIGENCE_PROVIDER` | `mock` | `mock` \| `openai` |
| `COMMUNICATION_INTELLIGENCE_MODEL` | `OPENAI_MODEL` / `gpt-4o-mini` | LLM model |
| `COMMUNICATION_INTELLIGENCE_TIMEOUT` | `30` | Seconds |
| `COMMUNICATION_INTELLIGENCE_MAX_CHARS` | `2500` | Truncate preview sent to model |
| `COMMUNICATION_INTELLIGENCE_DAILY_LIMIT` | `40` | Technical cap per user/day |

## Pipeline

1. Eligibility (inbound, not ignored, not noise, email, non-empty)
2. Content hash + version → skip re-analysis if unchanged
3. Daily cap + credit preflight (`COMMUNICATION_ANALYSIS`)
4. Analyzer (mock or OpenAI JSON)
5. Deterministic intent → suggestion mapping
6. Persist in `communication_analyses`
7. Usage event (tokens / estimated USD) — **no message body in logs**

## API

- `GET /api/communication-intelligence/{communicationId}`
- `POST /api/communication-intelligence/{communicationId}/analyze` `{ "force": false }`
- `POST /api/communication-intelligence/{communicationId}/accept`
- `POST /api/communication-intelligence/{communicationId}/reject`

Accept creates an Action Engine action with idempotency key  
`ci_accept:{communicationId}:{intent}`.

## Credits

Reuses `AIUsageService` with action key `COMMUNICATION_ANALYSIS` (default cost 5).
No parallel billing system.
