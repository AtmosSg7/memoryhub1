"""Basera HTML email layout — inline CSS, table-based, mobile-friendly."""

from __future__ import annotations

import html
from typing import Optional

from email_utils import support_email

BRAND_COLOR = "#4F46E5"
BRAND_DARK = "#0A0A0B"
TEXT_MUTED = "#52535E"
BORDER_COLOR = "#E7E9EE"
BG_PAGE = "#F3F4F6"
BG_CARD = "#FFFFFF"


def primary_button(label: str, url: str) -> str:
    safe_label = html.escape(label)
    safe_url = html.escape(url, quote=True)
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">'
        f'<tr><td align="center" bgcolor="{BRAND_COLOR}" style="border-radius:10px;">'
        f'<a href="{safe_url}" target="_blank" style="display:inline-block;padding:14px 28px;'
        f'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;'
        f'font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">'
        f"{safe_label}</a></td></tr></table>"
    )


def information_card(lines: list[str]) -> str:
    rows = []
    for line in lines:
        rows.append(
            f'<tr><td style="padding:6px 0;font-family:-apple-system,BlinkMacSystemFont,'
            f"'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:{TEXT_MUTED};"
            f'line-height:1.5;">{html.escape(line)}</td></tr>'
        )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="margin:16px 0;background:{BG_PAGE};border:1px solid {BORDER_COLOR};border-radius:10px;">'
        f'<tr><td style="padding:16px 20px;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        f"{''.join(rows)}"
        f"</table></td></tr></table>"
    )


def security_notice(text: str) -> str:
    return (
        f'<p style="margin:20px 0 0;font-family:-apple-system,BlinkMacSystemFont,'
        f"'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:{TEXT_MUTED};"
        f'line-height:1.5;background:{BG_PAGE};padding:12px 14px;border-radius:8px;">'
        f"{html.escape(text)}</p>"
    )


def footer_block(*, locale: str) -> str:
    support = support_email()
    if locale == "en":
        text = f"Need help? Contact us at {support}."
        tagline = "Basera — your client workspace."
    else:
        text = f"Besoin d'aide ? Contactez-nous à {support}."
        tagline = "Basera — votre espace client."
    return (
        f'<tr><td style="padding:24px 32px 32px;border-top:1px solid {BORDER_COLOR};">'
        f'<p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'
        f"'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#9CA3AF;"
        f'line-height:1.5;">{html.escape(text)}</p>'
        f'<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'
        f"'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#9CA3AF;"
        f'line-height:1.5;">{html.escape(tagline)}</p>'
        f"</td></tr>"
    )


def render_email_layout(
    *,
    locale: str,
    title: str,
    preheader: str,
    body_html: str,
    cta_label: Optional[str] = None,
    cta_url: Optional[str] = None,
    fallback_url: Optional[str] = None,
    security_text: Optional[str] = None,
) -> str:
    safe_title = html.escape(title)
    safe_preheader = html.escape(preheader)
    cta_html = primary_button(cta_label, cta_url) if cta_label and cta_url else ""
    fallback_html = ""
    if fallback_url and cta_label:
        if locale == "en":
            fallback_label = "If the button does not work, copy this link into your browser:"
        else:
            fallback_label = "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :"
        fallback_html = (
            f'<p style="margin:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'
            f"'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:{TEXT_MUTED};"
            f'line-height:1.5;word-break:break-all;">'
            f"{html.escape(fallback_label)}<br/>"
            f'<a href="{html.escape(fallback_url, quote=True)}" style="color:{BRAND_COLOR};">'
            f"{html.escape(fallback_url)}</a></p>"
        )
    security_html = security_notice(security_text) if security_text else ""

    return f"""<!DOCTYPE html>
<html lang="{html.escape(locale)}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>{safe_title}</title>
</head>
<body style="margin:0;padding:0;background:{BG_PAGE};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{safe_preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{BG_PAGE};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:{BG_CARD};border:1px solid {BORDER_COLOR};border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;text-align:center;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:{BRAND_COLOR};letter-spacing:-0.02em;">Basera</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;">
              <h1 style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;color:{BRAND_DARK};line-height:1.3;">{safe_title}</h1>
              {body_html}
              {cta_html}
              {fallback_html}
              {security_html}
            </td>
          </tr>
          {footer_block(locale=locale)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
