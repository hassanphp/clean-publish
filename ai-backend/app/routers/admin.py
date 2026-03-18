"""Admin-only endpoints (feature flags, feedback, dataset)."""

import os
from datetime import datetime, timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.routers.auth import get_current_user
from app.database import get_db
from app.models import User, AdminFeedback, JobImage
from app.feature_flags import get_flag_str, set_flag


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _require_superadmin(user: User) -> None:
    allowed = [e.strip().lower() for e in os.getenv("SUPERADMIN_EMAILS", "").split(",") if e.strip()]
    if not allowed or (user.email or "").lower() not in allowed:
        raise HTTPException(status_code=403, detail="Forbidden")


# --- Feature flags ---

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


# --- Feedback ---

class FeedbackCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    category: str | None = Field(None, max_length=64)


class FeedbackUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    content: str | None = None
    status: str | None = Field(None, max_length=32)


@router.get("/feedback")
def list_feedback(
    status: str | None = Query(None),
    category: str | None = Query(None),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_superadmin(current_user)
    q = db.query(AdminFeedback)
    if status:
        q = q.filter(AdminFeedback.status == status)
    if category:
        q = q.filter(AdminFeedback.category == category)
    items = q.order_by(desc(AdminFeedback.created_at)).limit(limit).all()
    return [{"id": f.id, "title": f.title, "content": f.content, "category": f.category, "status": f.status, "created_by": f.created_by, "created_at": f.created_at.isoformat() if f.created_at else None} for f in items]


@router.post("/feedback")
def create_feedback(
    body: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_superadmin(current_user)
    f = AdminFeedback(title=body.title, content=body.content, category=body.category, created_by=current_user.email)
    db.add(f)
    db.commit()
    db.refresh(f)
    return {"id": f.id, "title": f.title, "status": f.status}


@router.patch("/feedback/{feedback_id}")
def update_feedback(
    feedback_id: int,
    body: FeedbackUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_superadmin(current_user)
    f = db.query(AdminFeedback).filter(AdminFeedback.id == feedback_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")
    if body.title is not None:
        f.title = body.title
    if body.content is not None:
        f.content = body.content
    if body.status is not None:
        f.status = body.status
    db.commit()
    return {"ok": True}


# --- Dataset (from JobImages) ---

@router.get("/dataset/stats")
def dataset_stats(
    days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Count JobImages from the last N days for dataset creation."""
    _require_superadmin(current_user)
    since = datetime.utcnow() - timedelta(days=days)
    count = db.query(JobImage).filter(JobImage.updated_at >= since, JobImage.status == "completed").count()
    total = db.query(JobImage).filter(JobImage.status == "completed").count()
    return {"last_n_days": days, "count": count, "total_completed": total}


@router.get("/dataset/export")
def export_dataset(
    days: int = Query(7, ge=1, le=90),
    format: str = Query("manifest", description="manifest or json"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export dataset manifest (original + processed pairs) from JobImages."""
    _require_superadmin(current_user)
    since = datetime.utcnow() - timedelta(days=days)
    items = (
        db.query(JobImage)
        .filter(JobImage.updated_at >= since, JobImage.status == "completed")
        .order_by(JobImage.updated_at.desc())
        .limit(5000)
        .all()
    )
    manifest = [
        {
            "id": ji.id,
            "project_id": ji.project_id,
            "image_index": ji.image_index,
            "original_url": ji.original_url,
            "processed_url": ji.processed_url,
            "metadata": ji.metadata_json,
            "created_at": ji.created_at.isoformat() if ji.created_at else None,
        }
        for ji in items
    ]
    import json
    content = json.dumps({"dataset": manifest, "exported_at": datetime.utcnow().isoformat(), "days": days}, indent=2)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=carveo-dataset-{days}d.json"},
    )


@router.get("/smoke-test")
def run_smoke_test(current_user: User = Depends(get_current_user)):
    """Trigger smoke test - returns instructions; actual test runs via CLI."""
    _require_superadmin(current_user)
    return {
        "message": "Smoke test runs via CLI. From ai-backend: SMOKE_API_BASE=https://api.carveo.eu python scripts/smoke_v11.py",
        "scripts": ["smoke_v11.py", "test_2_images_v11.py", "run_pair_v11.py"],
    }
