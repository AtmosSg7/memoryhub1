from typing import Dict, Optional

from fastapi import HTTPException

MIME_ALIASES = {
    "image/jpg": "image/jpeg",
    "application/x-zip-compressed": "application/zip",
}


def validate_mime_for_extension(ext: str, content_type: Optional[str], allowed: Dict[str, str]) -> str:
    expected = allowed[ext]
    if not content_type:
        return expected

    normalized = content_type.split(";")[0].strip().lower()
    if normalized in ("application/octet-stream", "binary/octet-stream"):
        return expected

    resolved = MIME_ALIASES.get(normalized, normalized)
    if resolved != expected.lower():
        raise HTTPException(
            status_code=400,
            detail={"message": "File content type does not match the file extension."},
        )
    return expected


def _matches_webp(content: bytes) -> bool:
    return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"


def _matches_zip(content: bytes) -> bool:
    return content[:4] in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")


def validate_file_magic(ext: str, content: bytes) -> None:
    if not content:
        raise HTTPException(status_code=400, detail={"message": "File is empty."})

    checks = {
        "pdf": content.startswith(b"%PDF"),
        "jpg": content.startswith(b"\xff\xd8\xff"),
        "jpeg": content.startswith(b"\xff\xd8\xff"),
        "png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "webp": _matches_webp(content),
        "zip": _matches_zip(content),
    }

    if ext in checks and not checks[ext]:
        raise HTTPException(
            status_code=400,
            detail={"message": "File content does not match the declared file type."},
        )
