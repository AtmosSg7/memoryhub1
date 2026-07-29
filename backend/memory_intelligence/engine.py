"""Rule engine — evaluate configurable rules against facts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, List, Optional, Sequence

from memory_intelligence.models import (
    ClientFacts,
    MemorySignal,
    WorkspaceFacts,
)


@dataclass(frozen=True)
class RuleContext:
    """Shared context for rule evaluation."""

    client: Optional[ClientFacts] = None
    workspace: Optional[WorkspaceFacts] = None
    now_iso: str = ""


RuleFn = Callable[[RuleContext], List[MemorySignal]]


@dataclass(frozen=True)
class Rule:
    """Declarative rule registration (not UI-bound)."""

    id: str
    kind: str  # insight | action
    category: str
    evaluate: RuleFn = field(repr=False, compare=False)
    priority: str = "medium"
    description: str = ""
    enabled: bool = True
    # Future channel tags: email | phone | whatsapp | calendar | photo | ai
    channels: tuple = ("crm",)


_REGISTRY: List[Rule] = []


def register_rule(rule: Rule) -> Rule:
    _REGISTRY.append(rule)
    return rule


def all_rules() -> Sequence[Rule]:
    return tuple(_REGISTRY)


def clear_rules_for_tests() -> None:
    _REGISTRY.clear()


def evaluate_rules(
    ctx: RuleContext,
    *,
    kinds: Optional[Sequence[str]] = None,
    rule_ids: Optional[Sequence[str]] = None,
) -> List[MemorySignal]:
    """Run enabled rules and return signals."""
    signals: List[MemorySignal] = []
    kind_set = set(kinds) if kinds else None
    id_set = set(rule_ids) if rule_ids else None

    for rule in _REGISTRY:
        if not rule.enabled:
            continue
        if kind_set and rule.kind not in kind_set:
            continue
        if id_set and rule.id not in id_set:
            continue
        try:
            produced = rule.evaluate(ctx) or []
        except Exception:
            continue
        signals.extend(produced)
    return signals


PRIORITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def sort_signals(signals: Sequence[MemorySignal]) -> List[MemorySignal]:
    return sorted(
        signals,
        key=lambda s: (PRIORITY_RANK.get(s.priority, 9), s.date or "", s.id),
    )
