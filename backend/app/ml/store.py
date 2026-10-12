"""Persist and load the trained PM2.5 model + its LOSO validation metrics."""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone

from app.ml.features import FEATURE_NAMES

_lock = threading.Lock()
_cache: dict | None = None
_cache_loaded = False

MODEL_PATH = os.getenv("MODEL_PATH", "backend/data/models/pm25_ridge.json")


def _ensure_parent() -> None:
    parent = os.path.dirname(MODEL_PATH)
    if parent:
        os.makedirs(parent, exist_ok=True)


def save_model(model: dict) -> str:
    global _cache, _cache_loaded
    with _lock:
        _ensure_parent()
        payload = dict(model)
        payload["trained_at"] = datetime.now(timezone.utc).isoformat()
        payload["feature_names"] = list(FEATURE_NAMES)
        with open(MODEL_PATH, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
        _cache = payload
        _cache_loaded = True
    return MODEL_PATH


def load_model() -> dict | None:
    """Return the trained model, or None when no validated model exists (never fabricate)."""
    global _cache, _cache_loaded
    with _lock:
        if _cache_loaded:
            return _cache
        if not os.path.exists(MODEL_PATH):
            _cache_loaded = True
            _cache = None
            return None
        try:
            with open(MODEL_PATH, "r", encoding="utf-8") as fh:
                _cache = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            print(f"model load failed: {exc}")
            _cache = None
        _cache_loaded = True
        return _cache


def clear_cache() -> None:
    global _cache, _cache_loaded
    with _lock:
        _cache = None
        _cache_loaded = False
