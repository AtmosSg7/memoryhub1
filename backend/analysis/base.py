from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

from import_models import AnalysisResultData


@dataclass(frozen=True)
class AnalysisPage:
    index: int
    content: bytes
    mime_type: str
    extension: str


@dataclass
class AnalysisContext:
    filename: str
    mime_type: str
    extension: str
    user_id: str
    pages: List[AnalysisPage] = field(default_factory=list)
    source_type: str = "single"
    page_count: int = 1
    image_count: int = 0
    preprocessing_warnings: List[str] = field(default_factory=list)


class DocumentAnalyzer(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @property
    @abstractmethod
    def provider_version(self) -> str:
        ...

    @abstractmethod
    async def analyze(
        self,
        content: bytes,
        context: AnalysisContext,
    ) -> AnalysisResultData:
        ...
