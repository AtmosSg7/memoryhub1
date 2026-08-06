#!/usr/bin/env python3
"""Run idempotent scheduled maintenance tasks (email retries, etc.)."""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env", override=False)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [scheduler] %(message)s",
)
logger = logging.getLogger("scheduler")


async def run_once() -> dict:
    from motor.motor_asyncio import AsyncIOMotorClient
    from email_queue_service import process_pending_email_retries

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    try:
        await db.command("ping")
        retried = await process_pending_email_retries(db)
        logger.info("Email retries processed: %s", retried)

        from commercial_lifecycle import expire_stale_quotes, sync_overdue_invoices

        expired_quotes = await expire_stale_quotes(db)
        logger.info("Expired quotes processed: %s", expired_quotes)

        overdue_invoices = await sync_overdue_invoices(db)
        logger.info("Overdue invoices processed: %s", overdue_invoices)

        from scheduled_email_service import run_scheduled_invoice_emails

        invoice_emails = await run_scheduled_invoice_emails(db)
        logger.info("Scheduled invoice emails: %s", invoice_emails)

        gmail_auto_sync = {"enabled": False, "skipped": True}
        try:
            from integrations.gmail_auto_sync_job import run_gmail_auto_sync

            gmail_auto_sync = await run_gmail_auto_sync(db)
            logger.info("Gmail auto-sync: %s", gmail_auto_sync)
        except Exception:
            # Never let Gmail sync take down the rest of the scheduler.
            logger.exception("Gmail auto-sync tick failed")
            gmail_auto_sync = {"enabled": True, "error": "tick_failed"}

        return {
            "email_retries": retried,
            "expired_quotes": expired_quotes,
            "overdue_invoices": overdue_invoices,
            "invoice_emails": invoice_emails,
            "gmail_auto_sync": gmail_auto_sync,
        }
    finally:
        client.close()


async def main(loop: bool, interval: int) -> int:
    if loop:
        logger.info("Scheduler loop started (interval=%ss)", interval)
        while True:
            try:
                await run_once()
            except Exception:
                logger.exception("Scheduled task run failed")
            await asyncio.sleep(interval)
    else:
        await run_once()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MemoryHub scheduled tasks")
    parser.add_argument("--loop", action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=int, default=300, help="Loop interval seconds")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.loop, args.interval)))
