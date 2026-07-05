import os
from typing import Optional

from analysis.base import DocumentAnalyzer
from analysis.mock import MockAnalyzer
from analysis.openai_analyzer import OpenAIAnalyzer

_analyzer: Optional[DocumentAnalyzer] = None


def get_analyzer() -> DocumentAnalyzer:
    global _analyzer
    if _analyzer is not None:
        return _analyzer

    provider = os.environ.get("ANALYZER_PROVIDER", "mock").lower()
    if provider == "mock":
        _analyzer = MockAnalyzer()
    elif provider == "openai":
        _analyzer = OpenAIAnalyzer()
    else:
        raise RuntimeError(
            f"Unsupported ANALYZER_PROVIDER: {provider}. "
            "Supported values: mock, openai."
        )
    return _analyzer
