"""Demo seed safety: production blocked."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"


def _load_script(name: str):
    path = SCRIPTS / name
    spec = importlib.util.spec_from_file_location(name.replace(".py", ""), path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_seed_dev_demo_refuses_production(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    module = _load_script("seed_dev_demo.py")
    assert module.main() == 1


def test_clear_dev_demo_refuses_production(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    module = _load_script("clear_dev_demo.py")
    assert module.main() == 1
