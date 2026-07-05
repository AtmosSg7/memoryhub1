from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO, Union


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, key: str, content: bytes) -> None:
        ...

    @abstractmethod
    async def get_path(self, key: str) -> Path:
        """Return a local filesystem path for streaming (local backend)."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        ...

    @abstractmethod
    def provider_name(self) -> str:
        ...
