"""Small Redis-backed cache for expensive AI calls.

Designed to reduce costs without changing outputs: for the same inputs,
we return the exact previously-computed result.
"""

from __future__ import annotations

import hashlib
import json
import os
from typing import Any


def _redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://localhost:6379")


_redis_sync = None


def get_redis_sync():
    """Get a sync Redis client. Returns None if Redis is unavailable."""
    global _redis_sync
    if _redis_sync is not None:
        return _redis_sync
    try:
        import redis

        _redis_sync = redis.from_url(_redis_url(), decode_responses=True)
        # Lightweight connectivity check (won't raise if Redis is down)
        _redis_sync.ping()
        return _redis_sync
    except Exception:
        _redis_sync = None
        return None


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8", errors="ignore")).hexdigest()


def sha256_b64(data_uri_or_b64: str) -> str:
    raw = data_uri_or_b64.split(",", 1)[1] if "," in data_uri_or_b64 else data_uri_or_b64
    return sha256_text(raw)


def cache_get_json(key: str) -> Any | None:
    r = get_redis_sync()
    if not r:
        return None
    try:
        val = r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def cache_set_json(key: str, value: Any, ttl_seconds: int = 60 * 60 * 24 * 30) -> None:
    r = get_redis_sync()
    if not r:
        return
    try:
        r.setex(key, ttl_seconds, json.dumps(value))
    except Exception:
        return

