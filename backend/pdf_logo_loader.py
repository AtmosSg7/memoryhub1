"""Load and normalize company logos for PDF rendering."""

from __future__ import annotations

import logging
from io import BytesIO
from typing import Optional

logger = logging.getLogger(__name__)


def resolve_pdf_logo_storage_key(seller: Optional[dict]) -> Optional[str]:
    if not seller:
        return None
    return seller.get("pdfLogoStorageKey") or seller.get("logoStorageKey")


async def load_pdf_logo_bytes(storage_key: Optional[str]) -> Optional[bytes]:
    """Read logo bytes once from storage; return None on any failure."""
    if not storage_key:
        return None
    try:
        from storage import get_storage

        storage = get_storage()
        path = await storage.get_path(storage_key)
        raw = path.read_bytes()
        if not raw:
            logger.warning("PDF logo is empty: %s", storage_key)
            return None
        return prepare_logo_bytes(raw)
    except FileNotFoundError:
        logger.warning("PDF logo not found: %s", storage_key)
        return None
    except Exception:
        logger.exception("Failed to load PDF logo: %s", storage_key)
        return None


def prepare_logo_bytes(raw: bytes) -> Optional[bytes]:
    """Validate image data and normalize to a ReportLab-friendly format."""
    try:
        from PIL import Image, UnidentifiedImageError

        with Image.open(BytesIO(raw)) as img:
            img.load()
            width, height = img.size
            if width <= 0 or height <= 0:
                logger.warning("PDF logo has invalid dimensions: %sx%s", width, height)
                return None

            if img.format in {"PNG", "JPEG"} and img.mode in {"RGB", "L", "RGBA"}:
                return raw

            buffer = BytesIO()
            normalized = img.convert("RGBA") if "A" in img.mode else img.convert("RGB")
            normalized.save(buffer, format="PNG")
            return buffer.getvalue()
    except UnidentifiedImageError:
        logger.warning("PDF logo is not a supported image format")
        return None
    except Exception:
        logger.exception("Failed to prepare PDF logo bytes")
        return None
