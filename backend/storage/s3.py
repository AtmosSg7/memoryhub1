import os
from pathlib import Path
from typing import Optional

from storage.base import StorageBackend


class S3Storage(StorageBackend):
    """S3-compatible storage (AWS S3 / Cloudflare R2). Requires env configuration."""

    def __init__(
        self,
        bucket: str,
        region: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        cache_dir: Optional[str] = None,
    ):
        import boto3

        self.bucket = bucket
        self.cache_dir = Path(cache_dir or "./uploads/.s3-cache").resolve()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.client = boto3.client(
            "s3",
            region_name=region or os.environ.get("AWS_REGION", "auto"),
            endpoint_url=endpoint_url or os.environ.get("S3_ENDPOINT_URL"),
        )

    def _cache_path(self, key: str) -> Path:
        path = (self.cache_dir / key).resolve()
        if not str(path).startswith(str(self.cache_dir)):
            raise ValueError("Invalid storage key.")
        return path

    async def save(self, key: str, content: bytes) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content)

    async def get_path(self, key: str) -> Path:
        path = self._cache_path(key)
        if not path.is_file():
            path.parent.mkdir(parents=True, exist_ok=True)
            self.client.download_file(self.bucket, key, str(path))
        return path

    async def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)
        path = self._cache_path(key)
        if path.is_file():
            path.unlink()

    def provider_name(self) -> str:
        return "s3"
