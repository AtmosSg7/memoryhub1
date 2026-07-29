"""Idempotent MongoDB index helpers — migrate on spec conflicts."""

from __future__ import annotations

from typing import Any, List, Tuple, Union

from pymongo.errors import OperationFailure

IndexKey = Union[str, Tuple[str, Union[int, str]]]
IndexKeys = List[IndexKey]

INDEX_CONFLICT_CODE = 86
INDEX_NAME_CONFLICT_CODE = 85


async def drop_index_if_exists(collection, name: str) -> None:
    try:
        await collection.drop_index(name)
    except Exception:
        pass


async def ensure_index(
    collection,
    keys: IndexKeys,
    *,
    name: str,
    **kwargs: Any,
) -> str:
    """
    Create an index, replacing it when an existing index shares the same name
    but differs in specification (e.g. sparse vs partialFilterExpression),
    or when a legacy auto-generated name already covers the same keys.
    """
    try:
        return await collection.create_index(keys, name=name, **kwargs)
    except OperationFailure as exc:
        if exc.code not in (INDEX_CONFLICT_CODE, INDEX_NAME_CONFLICT_CODE):
            raise
        try:
            await collection.drop_index(name)
        except Exception:
            pass
        legacy = _legacy_auto_name(keys)
        if legacy != name:
            try:
                await collection.drop_index(legacy)
            except Exception:
                pass
        return await collection.create_index(keys, name=name, **kwargs)


def _legacy_auto_name(keys: IndexKeys) -> str:
    parts = []
    for key in keys:
        if isinstance(key, tuple):
            field, direction = key
            parts.append(f"{field}_{direction}")
        else:
            parts.append(f"{key}_1")
    return "_".join(parts)
