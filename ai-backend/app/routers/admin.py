"""Admin-only endpoints (feature flags)."""

import os
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.routers.auth import get_current_user
from app.models import User
from app.feature_flags import get_flag_str, set_flag


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _require_superadmin(user: User) -> None:
    allowed = [e.strip().lower() for e in os.getenv("SUPERADMIN_EMAILS", "").split(",") if e.strip()]
    if not allowed or (user.email or "").lower() not in allowed:
        raise HTTPException(status_code=403, detail="Forbidden")


class FlagItem(BaseModel):
    key: str = Field(..., min_length=1, max_length=128)
    value: str = Field(..., min_length=0, max_length=1024)


@router.get("/feature-flags")
def list_flags(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    _require_superadmin(current_user)
    keys = ["enforce_4_3", "center_on_turntable", "color_lock_strict"]
    return {k: get_flag_str(k, None) for k in keys}


@router.put("/feature-flags")
def upsert_flag(item: FlagItem, current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    _require_superadmin(current_user)
    set_flag(item.key, item.value)
    return {"ok": True}
