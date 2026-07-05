import os

from storage.base import StorageBackend
from storage.local import LocalStorage
from storage.s3 import S3Storage

_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage
    if _storage is not None:
        return _storage

    backend = os.environ.get("STORAGE_BACKEND", "local").lower()
    if backend == "local":
        upload_dir = os.environ.get("LOCAL_UPLOAD_DIR", "./uploads")
        _storage = LocalStorage(upload_dir)
    elif backend == "s3":
        bucket = os.environ.get("S3_BUCKET")
        if not bucket:
            raise RuntimeError("S3_BUCKET is required when STORAGE_BACKEND=s3.")
        _storage = S3Storage(
            bucket=bucket,
            region=os.environ.get("AWS_REGION"),
            endpoint_url=os.environ.get("S3_ENDPOINT_URL"),
            cache_dir=os.environ.get("LOCAL_UPLOAD_DIR", "./uploads/.s3-cache"),
        )
    else:
        raise RuntimeError(f"Unsupported STORAGE_BACKEND: {backend}")

    return _storage
