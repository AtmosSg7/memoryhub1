"""Non-blocking hooks after communication ingestion."""

from __future__ import annotations

import asyncio
import logging

from communication_intelligence.constants import ci_auto_on_ingest, ci_enabled

logger = logging.getLogger(__name__)


async def _run_ingest_analyze(db, communication: dict) -> None:
    try:
        from communication_intelligence.service import analyze_communication

        user_id = communication.get("userId")
        comm_id = communication.get("id")
        if not user_id or not comm_id:
            return
        await analyze_communication(
            db, user_id, comm_id, force=False, trigger="ingest"
        )
    except PermissionError:
        return
    except Exception as exc:
        # Never break Gmail sync / writers.
        logger.warning(
            "ci.ingest_hook.failed comm=%s error=%s",
            (communication or {}).get("id"),
            type(exc).__name__,
        )


def schedule_analyze_after_ingest(db, communication: dict) -> None:
    """Fire-and-forget when both feature flags allow auto analysis."""
    if not ci_enabled() or not ci_auto_on_ingest():
        return
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_run_ingest_analyze(db, communication))
    except RuntimeError:
        # No running loop — skip (sync contexts / tests without loop).
        return


async def safe_maybe_analyze_after_ingest(db, communication: dict) -> None:
    """Awaitable safe variant (never raises). Used when awaiting is preferred."""
    if not ci_enabled() or not ci_auto_on_ingest():
        return
    await _run_ingest_analyze(db, communication)
