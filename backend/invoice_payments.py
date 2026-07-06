import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

PaymentMethod = Literal["transfer", "card", "cash", "check", "other"]


class InvoicePaymentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    amount: int = Field(..., ge=0)
    paidAt: str
    method: PaymentMethod = "transfer"
    note: Optional[str] = None


class InvoicePaymentCreate(BaseModel):
    amount: int = Field(..., gt=0)
    paidAt: Optional[str] = None
    method: PaymentMethod = "transfer"
    note: Optional[str] = Field(None, max_length=500)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_amount_paid(doc: dict) -> int:
    paid = max(0, int(doc.get("amountPaid") or 0))
    status = doc.get("status")
    if paid == 0 and status in {"paid", "Paid"}:
        return max(0, int(doc.get("amountTTC") or 0))
    return paid


def compute_amount_due(amount_ttc: int, amount_paid: int) -> int:
    return max(0, int(amount_ttc or 0) - max(0, int(amount_paid or 0)))


def parse_payment_records(raw) -> List[InvoicePaymentRecord]:
    if not raw:
        return []
    items = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        try:
            items.append(InvoicePaymentRecord(**entry))
        except Exception:
            continue
    return items


def resolve_status_after_payment(current_status: str, amount_ttc: int, amount_paid: int) -> str:
    if amount_paid >= amount_ttc:
        return "paid"
    if current_status == "cancelled":
        return "cancelled"
    if current_status == "overdue":
        return "overdue"
    return "in_progress"


def parse_payment_date(value: Optional[str], fallback: str) -> str:
    if not value or not str(value).strip():
        return fallback
    try:
        normalized = str(value).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError:
        return fallback


def build_payment_update(
    doc: dict,
    *,
    amount: int,
    paid_at: Optional[str],
    method: PaymentMethod,
    note: Optional[str],
) -> dict:
    amount_ttc = int(doc.get("amountTTC") or 0)
    current_paid = get_amount_paid(doc)
    amount_due = compute_amount_due(amount_ttc, current_paid)
    if amount > amount_due:
        raise ValueError("Le montant dépasse le reste à payer.")

    now = utc_now_iso()
    payment_date = parse_payment_date(paid_at, now)
    record = InvoicePaymentRecord(
        id=str(uuid.uuid4()),
        amount=amount,
        paidAt=payment_date,
        method=method,
        note=(note or "").strip() or None,
    )

    payments = [item.model_dump() for item in parse_payment_records(doc.get("payments"))]
    payments.append(record.model_dump())

    new_paid = current_paid + amount
    current_status = doc.get("status") or "in_progress"
    new_status = resolve_status_after_payment(current_status, amount_ttc, new_paid)

    update = {
        "amountPaid": new_paid,
        "payments": payments,
        "updatedAt": now,
        "status": new_status,
    }
    if new_status == "paid":
        update["paidAt"] = payment_date
    return {
        "update": update,
        "record": record,
        "amountDue": compute_amount_due(amount_ttc, new_paid),
        "isFullyPaid": new_status == "paid",
    }


def build_full_payment_update(doc: dict, paid_at: Optional[str] = None) -> dict:
    amount_ttc = int(doc.get("amountTTC") or 0)
    amount_due = compute_amount_due(amount_ttc, get_amount_paid(doc))
    if amount_due <= 0:
        raise ValueError("Cette facture est déjà entièrement payée.")
    return build_payment_update(
        doc,
        amount=amount_due,
        paid_at=paid_at,
        method="transfer",
        note=None,
    )


def build_reopen_payment_update(doc: dict) -> dict:
    now = utc_now_iso()
    return {
        "status": "in_progress",
        "amountPaid": 0,
        "payments": [],
        "updatedAt": now,
        "paidAt": None,
    }
