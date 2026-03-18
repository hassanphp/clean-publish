"""Feature flags with DB + env fallback and small in-process cache."""

import os
import time
from typing import Optional
from app.database import SessionLocal
from app.models import FeatureFlag

_cache: dict[str, tuple[str, float]] = {}
_ttl_sec = 10.0


def _now() -> float:
    return time.time()


def get_flag_str(key: str, default: str | None = None) -> Optional[str]:
    # Env override first
    env_key = f"FF_{key.upper()}"
    if env_key in os.environ:
        return os.environ[env_key]

    # Cache lookup
    if key in _cache:
        val, ts = _cache[key]
        if _now() - ts < _ttl_sec:
            return val

    # DB lookup (table may not exist yet)
    try:
        db = SessionLocal()
        try:
            row = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
            if row and row.value is not None:
                _cache[key] = (row.value, _now())
                return row.value
        finally:
            db.close()
    except Exception:
        pass
    return default


def get_flag_bool(key: str, default: bool = True) -> bool:
    s = get_flag_str(key, None)
    if s is None:
        return default
    return s.strip().lower() in ("1", "true", "yes", "on")


def set_flag(key: str, value: str) -> None:
    try:
        db = SessionLocal()
        try:
            row = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
            if row:
                row.value = value
            else:
                row = FeatureFlag(key=key, value=value)
                db.add(row)
            db.commit()
            _cache[key] = (value, _now())
        finally:
            db.close()
    except Exception:
        pass
