"""User-facing AI analysis product constants — credits remain internal."""

from __future__ import annotations

import os

# Internal conversion: 1 user-visible analysis = N ledger credits.
CREDITS_PER_ANALYSIS = max(1, int(os.environ.get("CREDITS_PER_ANALYSIS", "50")))

# Re-export import limits from the centralized import engine config.
from import_constants import (  # noqa: E402
    IMPORT_MAX_FILE_SIZE_BYTES,
    IMPORT_MAX_IMAGES,
    IMPORT_MAX_PDF_PAGES,
    IMPORT_MAX_TOTAL_SIZE_BYTES,
)
