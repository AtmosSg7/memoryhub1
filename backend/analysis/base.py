from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from import_models import AnalysisResultData


@dataclass
class AnalysisContext:
    filename: str
    mime_type: str
    extension: str
    user_id: str


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
