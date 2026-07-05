from pathlib import Path

from storage.base import StorageBackend


class LocalStorage(StorageBackend):
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _full_path(self, key: str) -> Path:
        full = (self.base_dir / key).resolve()
        if not str(full).startswith(str(self.base_dir)):
            raise ValueError("Invalid storage key.")
        return full

    async def save(self, key: str, content: bytes) -> None:
        path = self._full_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    async def get_path(self, key: str) -> Path:
        path = self._full_path(key)
        if not path.is_file():
            raise FileNotFoundError(key)
        return path

    async def delete(self, key: str) -> None:
        path = self._full_path(key)
        if path.is_file():
            path.unlink()

    def provider_name(self) -> str:
        return "local"
