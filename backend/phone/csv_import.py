"""Phone Hub V2 — robust CSV call-log import (preview / dry-run / import)."""

from __future__ import annotations

import csv
import hashlib
import io
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from phone.constants import VENDOR_CSV
from phone.conversation_service import PhoneConversationService
from phone.models import (
    CsvImportPreviewResponse,
    CsvImportReport,
    CsvImportRowPreview,
    RemoteCall,
)
from phone.normalizer import PhoneNormalizer

COLUMN_ALIASES: Dict[str, Tuple[str, ...]] = {
    "number": ("number", "phone", "numéro", "numero", "telephone", "téléphone", "tel", "msisdn"),
    "direction": ("direction", "sens", "type", "call_type", "calltype"),
    "status": ("status", "statut", "state", "état", "etat", "disposition"),
    "startedAt": (
        "startedat",
        "started_at",
        "date",
        "datetime",
        "start",
        "start_time",
        "starttime",
        "calldate",
        "call_date",
        "timestamp",
    ),
    "endedAt": ("endedat", "ended_at", "end", "end_time", "endtime"),
    "duration": ("duration", "durée", "duree", "seconds", "secs", "length"),
    "name": ("name", "nom", "contact", "caller", "caller_name", "display_name"),
    "note": ("note", "notes", "commentaire", "comment", "memo"),
}


def _norm_header(value: str) -> str:
    return re.sub(r"[\s\-]+", "", (value or "").strip().lower())


def _map_headers(headers: List[str]) -> Dict[str, str]:
    """Return canonical_field → original header name."""
    mapped: Dict[str, str] = {}
    normalized = {_norm_header(h): h for h in headers if h}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            key = _norm_header(alias)
            if key in normalized:
                mapped[canonical] = normalized[key]
                break
    return mapped


def _parse_duration(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return max(0, int(value))
    text = str(value).strip().replace(",", ".")
    if not text:
        return None
    # HH:MM:SS or MM:SS
    if ":" in text:
        parts = text.split(":")
        try:
            parts_i = [int(float(p)) for p in parts]
        except ValueError:
            return None
        if len(parts_i) == 3:
            return max(0, parts_i[0] * 3600 + parts_i[1] * 60 + parts_i[2])
        if len(parts_i) == 2:
            return max(0, parts_i[0] * 60 + parts_i[1])
    try:
        return max(0, int(float(text)))
    except ValueError:
        return None


def _parse_datetime(value: Any) -> Optional[str]:
    if value is None or value == "":
        return None
    text = str(value).strip()
    if not text:
        return None
    # Already ISO-ish
    for candidate in (text, text.replace(" ", "T"), text.replace("/", "-")):
        try:
            raw = candidate
            if raw.endswith("Z"):
                raw = raw[:-1] + "+00:00"
            dt = datetime.fromisoformat(raw)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            pass
    # FR common: DD/MM/YYYY HH:MM[:SS]
    for fmt in (
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            continue
    return None


def _csv_provider_call_id(
    *,
    normalized: str,
    started_at: str,
    direction: str,
    status: str,
    duration: Optional[int],
) -> str:
    raw = f"{normalized}|{started_at}|{direction}|{status}|{duration or 0}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:28]
    return f"csv:{digest}"


def _row_get(row: Dict[str, str], mapping: Dict[str, str], field: str) -> str:
    header = mapping.get(field)
    if not header:
        return ""
    return (row.get(header) or "").strip()


def parse_csv_text(content: str) -> Tuple[List[str], List[Dict[str, str]], Dict[str, str]]:
    sample = content[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
        if sample.count(";") > sample.count(","):
            dialect.delimiter = ";"
    reader = csv.DictReader(io.StringIO(content), dialect=dialect)
    headers = list(reader.fieldnames or [])
    rows = [dict(r) for r in reader]
    mapping = _map_headers(headers)
    return headers, rows, mapping


def validate_row(
    row: Dict[str, str],
    mapping: Dict[str, str],
    *,
    line_number: int,
) -> CsvImportRowPreview:
    normalizer = PhoneNormalizer()
    number = _row_get(row, mapping, "number")
    identity = normalizer.identity(number)
    errors: List[str] = []
    if not identity:
        errors.append("invalid_or_missing_number")

    direction_raw = _row_get(row, mapping, "direction") or "incoming"
    direction = normalizer.normalize_direction(direction_raw)
    status_raw = _row_get(row, mapping, "status") or direction
    status = normalizer.normalize_status(status_raw, direction=direction)
    started = _parse_datetime(_row_get(row, mapping, "startedAt"))
    if not started and _row_get(row, mapping, "startedAt"):
        errors.append("invalid_startedAt")
    if not started:
        started = datetime.now(timezone.utc).isoformat()
    ended = _parse_datetime(_row_get(row, mapping, "endedAt"))
    duration = _parse_duration(_row_get(row, mapping, "duration"))
    name = _row_get(row, mapping, "name") or None
    note = _row_get(row, mapping, "note") or None

    provider_call_id = None
    if identity:
        provider_call_id = _csv_provider_call_id(
            normalized=identity.normalized,
            started_at=started,
            direction=direction,
            status=status,
            duration=duration,
        )

    return CsvImportRowPreview(
        lineNumber=line_number,
        valid=len(errors) == 0,
        errors=errors,
        phoneNumber=number,
        normalizedPhone=identity.normalized if identity else "",
        direction=direction,
        status=status,
        startedAt=started,
        endedAt=ended,
        duration=duration,
        counterpartyName=name,
        notes=note,
        providerCallId=provider_call_id,
    )


async def preview_csv_import(
    db,
    user_id: str,
    content: str,
    *,
    max_preview: int = 50,
) -> CsvImportPreviewResponse:
    headers, rows, mapping = parse_csv_text(content)
    if "number" not in mapping:
        raise ValueError("missing_number_column")

    previews: List[CsvImportRowPreview] = []
    valid = invalid = duplicates = 0
    seen_ids: set = set()
    existing_ids: set = set()

    # Prefetch existing providerIds for this user (cap)
    cursor = db.communications.find(
        {"userId": user_id, "type": "phone", "providerId": {"$regex": "^csv:"}},
        {"_id": 0, "providerId": 1},
    ).limit(5000)
    async for doc in cursor:
        if doc.get("providerId"):
            existing_ids.add(doc["providerId"])

    for idx, row in enumerate(rows, start=2):
        preview = validate_row(row, mapping, line_number=idx)
        if not preview.valid:
            invalid += 1
        else:
            valid += 1
            pid = preview.providerCallId or ""
            if pid in seen_ids or pid in existing_ids:
                duplicates += 1
                preview = preview.model_copy(
                    update={"duplicate": True, "errors": list(preview.errors) + ["duplicate"]}
                )
            seen_ids.add(pid)
        if len(previews) < max_preview:
            previews.append(preview)

    return CsvImportPreviewResponse(
        headers=headers,
        mapping=mapping,
        totalRows=len(rows),
        validRows=valid,
        invalidRows=invalid,
        duplicateRows=duplicates,
        rows=previews,
    )


async def import_csv_calls(
    db,
    user_id: str,
    content: str,
    *,
    dry_run: bool = False,
) -> CsvImportReport:
    preview = await preview_csv_import(db, user_id, content, max_preview=10_000)
    imported = skipped_dup = skipped_invalid = linked = unmatched = 0
    service = PhoneConversationService(db) if not dry_run else None
    normalizer = PhoneNormalizer()

    for row in preview.rows:
        if not row.valid:
            skipped_invalid += 1
            continue
        if row.duplicate:
            skipped_dup += 1
            continue
        if dry_run:
            imported += 1
            continue

        remote = RemoteCall(
            providerCallId=row.providerCallId or "",
            provider="phone",
            vendor=VENDOR_CSV,
            phoneNumber=row.phoneNumber,
            counterpartyPhone=row.phoneNumber,
            direction=row.direction,  # type: ignore[arg-type]
            status=row.status,  # type: ignore[arg-type]
            startedAt=row.startedAt,
            endedAt=row.endedAt,
            duration=row.duration,
            voicemail=row.status == "voicemail",
            notes=row.notes,
            raw={"source": "csv", "counterpartyName": row.counterpartyName},
        )
        assert service is not None
        outcome = await service.ingest_remote_call(user_id, remote, vendor=VENDOR_CSV)
        if row.counterpartyName:
            await db.communications.update_one(
                {"userId": user_id, "provider": "phone", "providerId": row.providerCallId},
                {
                    "$set": {
                        "metadata.counterpartyName": row.counterpartyName,
                        "metadata.fromName": row.counterpartyName,
                    }
                },
            )
        imported += 1
        if outcome == "linked":
            linked += 1
        elif outcome == "unmatched":
            unmatched += 1

    return CsvImportReport(
        dryRun=dry_run,
        totalRows=preview.totalRows,
        imported=imported,
        skippedDuplicates=skipped_dup,
        skippedInvalid=skipped_invalid,
        linked=linked,
        unmatched=unmatched,
        mapping=preview.mapping,
    )
