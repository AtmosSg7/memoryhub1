"""Communication Intelligence — AI suggests; the user decides.

Channel-agnostic analysis layer (Gmail first). Never auto-creates clients,
quotes, invoices, or sends email. Never creates Action Engine actions without
explicit user acceptance.
"""

from communication_intelligence.service import (
    accept_suggestion,
    analyze_communication,
    get_analysis,
    reject_suggestion,
)

__all__ = [
    "analyze_communication",
    "get_analysis",
    "accept_suggestion",
    "reject_suggestion",
]
