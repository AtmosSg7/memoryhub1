from datetime import datetime, timezone
from typing import List, Optional


def _user_filter(user_id: str) -> dict:
    return {"userId": user_id}


async def refresh_quote_invoice_link(db, user_id: str, quote: dict) -> dict:
    invoice_id = quote.get("invoiceId")
    if not invoice_id:
        return quote

    invoice = await db.invoices.find_one(
        {**_user_filter(user_id), "id": invoice_id},
        {"_id": 1, "number": 1},
    )
    if invoice:
        if invoice.get("number") and invoice["number"] != quote.get("invoiceNumber"):
            return {**quote, "invoiceNumber": invoice["number"]}
        return quote

    now = datetime.now(timezone.utc).isoformat()
    await db.quotes.update_one(
        {"userId": user_id, "id": quote["id"]},
        {
            "$unset": {"invoiceId": "", "invoiceNumber": ""},
            "$set": {"updatedAt": now},
        },
    )
    return {k: v for k, v in quote.items() if k not in ("invoiceId", "invoiceNumber")}


async def refresh_quotes_invoice_links(db, user_id: str, quotes: List[dict]) -> List[dict]:
    if not quotes:
        return quotes

    invoice_ids = [q["invoiceId"] for q in quotes if q.get("invoiceId")]
    if not invoice_ids:
        return quotes

    existing_ids = set()
    async for inv in db.invoices.find(
        {**_user_filter(user_id), "id": {"$in": invoice_ids}},
        {"id": 1},
    ):
        existing_ids.add(inv["id"])

    now = datetime.now(timezone.utc).isoformat()
    refreshed = []
    for quote in quotes:
        invoice_id = quote.get("invoiceId")
        if not invoice_id:
            refreshed.append(quote)
            continue
        if invoice_id in existing_ids:
            refreshed.append(quote)
            continue
        await db.quotes.update_one(
            {"userId": user_id, "id": quote["id"]},
            {
                "$unset": {"invoiceId": "", "invoiceNumber": ""},
                "$set": {"updatedAt": now},
            },
        )
        refreshed.append(
            {k: v for k, v in quote.items() if k not in ("invoiceId", "invoiceNumber")}
        )
    return refreshed


async def clear_invoice_quote_links(db, user_id: str, invoice_id: str, quote_id: Optional[str] = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    unset = {"invoiceId": "", "invoiceNumber": ""}
    if quote_id:
        await db.quotes.update_one(
            {**_user_filter(user_id), "id": quote_id, "invoiceId": invoice_id},
            {"$unset": unset, "$set": {"updatedAt": now}},
        )
        return
    await db.quotes.update_many(
        {**_user_filter(user_id), "invoiceId": invoice_id},
        {"$unset": unset, "$set": {"updatedAt": now}},
    )
