#!/usr/bin/env python3
"""Generate local HTML previews for all transactional email templates."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from email_constants import ALL_TEMPLATE_KEYS  # noqa: E402
from emails_dev import _DEMO_CONTEXT  # noqa: E402
from email_renderer import render_template  # noqa: E402

OUT = ROOT / "email_previews"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for template in sorted(ALL_TEMPLATE_KEYS):
        for locale in ("fr", "en"):
            ctx = _DEMO_CONTEXT.get(template, {})
            rendered = render_template(template, locale=locale, context=ctx)
            base = f"{template}_{locale}"
            (OUT / f"{base}.html").write_text(rendered.html_body, encoding="utf-8")
            (OUT / f"{base}.txt").write_text(rendered.text_body, encoding="utf-8")
            print(f"Wrote {base}.html")
    print(f"Preview files in {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
