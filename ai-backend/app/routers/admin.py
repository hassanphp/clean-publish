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
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Superadmin access disabled. Set SUPERADMIN_EMAILS on the server (comma-separated emails).",
        )
    if (user.email or "").lower() not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied. Add {user.email} to SUPERADMIN_EMAILS on the server.",
        )


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


class AddCreditsRequest(BaseModel):
    user_id: int | None = Field(None, description="User ID to add credits to")
    user_email: str | None = Field(None, description="User email (alternative to user_id)")
    amount: int = Field(..., ge=1, le=100000, description="Credits to add")


@router.post("/credits")
def add_credits(
    body: AddCreditsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add credits to a user. Superadmin only."""
    _require_superadmin(current_user)
    user = None
    if body.user_id:
        user = db.query(User).filter(User.id == body.user_id).first()
    if not user and body.user_email:
        user = db.query(User).filter(User.email == body.user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.credits = (user.credits or 0) + body.amount
    db.commit()
    db.refresh(user)
    return {"ok": True, "user_id": user.id, "credits": user.credits}


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


# --- Judge (Fast MVP) ---

class JudgeImageInput(BaseModel):
    index: int
    original_b64: str
    processed_b64: str
    metadata: dict = Field(default_factory=dict)
    expected_view_category: str | None = Field(None, max_length=32)


class AdminJudgeRequest(BaseModel):
    pipeline_version: str = Field(default="11", max_length=4)
    preview: bool = Field(default=False)
    expected_aspect_ratio: str = Field(default="4:3", max_length=16)
    use_llm_judge: bool = Field(default=True)
    images: list[JudgeImageInput]


class JudgeImageResult(BaseModel):
    index: int
    verdict: bool
    aspect_ratio: float | None = None
    failed_constraints: list[str] = Field(default_factory=list)
    llm_verdict: str | None = None
    llm_reason: str | None = None


class AdminJudgeResponse(BaseModel):
    overall_pass: bool
    failed_images: list[int]
    summary: str | None = None
    per_image: list[JudgeImageResult]


def _strip_data_uri(b64: str) -> str:
    return b64.split(",", 1)[1] if "," in b64 else b64


def _aspect_ratio_4_3(w: int, h: int) -> float:
    # ratio = width / height
    if h == 0:
        return 0.0
    return float(w) / float(h)


def _check_aspect_ratio_4_3(processed_b64: str) -> tuple[bool, float | None]:
    """Deterministic check: output must be ~4:3 (tolerance allows minor resampling)."""
    raw = _strip_data_uri(processed_b64)
    try:
        import base64
        import numpy as np  # type: ignore
        import cv2  # type: ignore

        img_bytes = base64.b64decode(raw)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        im = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
        if im is None:
            raise ValueError("cv2.imdecode failed")

        # im is HxW or HxWxC
        h, w = im.shape[:2]
        ratio = _aspect_ratio_4_3(w, h)
        target = 4.0 / 3.0
        ok = abs(ratio - target) <= 0.03  # tolerance
        return ok, ratio
    except Exception:
        # Fallback to PIL if available
        try:
            from PIL import Image  # type: ignore
            import base64
            import io

            img_bytes = base64.b64decode(raw)
            with Image.open(io.BytesIO(img_bytes)) as im:
                w, h = im.size
            ratio = _aspect_ratio_4_3(w, h)
            target = 4.0 / 3.0
            ok = abs(ratio - target) <= 0.03  # tolerance
            return ok, ratio
        except Exception:
            return False, None


def _guess_mime_from_pil(pil_format: str | None) -> str:
    if not pil_format:
        return "image/jpeg"
    fmt = pil_format.upper()
    if fmt in ("JPG", "JPEG"):
        return "image/jpeg"
    if fmt == "PNG":
        return "image/png"
    if fmt == "WEBP":
        return "image/webp"
    return "image/jpeg"


def _to_data_url(b64: str, fallback_mime: str = "image/jpeg") -> str:
    raw = _strip_data_uri(b64)
    return f"data:{fallback_mime};base64,{raw}"


def _normalize_b64_to_jpeg_data_url(b64: str) -> str:
    """
    Normalize any incoming base64 image to a supported OpenAI input:
    - If possible, decode with OpenCV and re-encode as JPEG.
    - Otherwise, if b64 is already a supported data URI, return as-is.
    - Last resort: best-effort wrap as JPEG (may still fail if bytes aren't an image).
    """
    # If it's already a supported data URI, keep it (avoids breaking when PIL is missing).
    if b64.startswith("data:image/") and ";base64," in b64:
        try:
            mime = b64.split("data:", 1)[1].split(";", 1)[0].strip().lower()
            if mime in ("image/jpeg", "image/png", "image/gif", "image/webp"):
                return b64
        except Exception:
            pass

    raw = _strip_data_uri(b64)
    try:
        import base64
        import numpy as np  # type: ignore
        import cv2  # type: ignore

        img_bytes = base64.b64decode(raw)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        im = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
        if im is None:
            raise ValueError("cv2.imdecode failed")

        # Ensure 3-channel for consistent JPEG encoding
        if im.ndim == 2:
            im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
        elif im.ndim == 3 and im.shape[2] == 4:
            im = cv2.cvtColor(im, cv2.COLOR_BGRA2BGR)

        ok, enc = cv2.imencode(".jpg", im, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        if not ok or enc is None:
            raise ValueError("cv2.imencode failed")

        norm_raw = base64.b64encode(enc.tobytes()).decode("utf-8")
        return f"data:image/jpeg;base64,{norm_raw}"
    except Exception:
        # Fallback to PIL if available
        try:
            import base64
            import io
            from PIL import Image  # type: ignore

            img_bytes = base64.b64decode(raw)
            with Image.open(io.BytesIO(img_bytes)) as im:
                im = im.convert("RGB")
                out_buf = io.BytesIO()
                im.save(out_buf, format="JPEG", quality=95)
                norm_raw = base64.b64encode(out_buf.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{norm_raw}"
        except Exception:
            # Last resort: best-effort wrap (may fail if bytes aren't image data)
            return f"data:image/jpeg;base64,{raw}"


def _extract_first_json_object(text: str) -> dict[str, Any] | None:
    """Best-effort extraction for judge JSON."""
    try:
        import json
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        return json.loads(text[start : end + 1])
    except Exception:
        return None


def _llm_judge_pass_fail(
    *,
    original_b64: str,
    processed_b64: str,
    expected_view_category: str | None,
) -> tuple[str, str | None]:
    """
    Simple LLM judge: PASS/FAIL based on visual constraints.
    Runs only when deterministic checks pass.
    """
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        # If no OpenAI key, fall back to deterministic-only pass.
        return "PASS", "OPENAI_API_KEY not set; skipping LLM judge."

    # Normalize to JPEG for consistent OpenAI Vision compatibility.
    original_url = _normalize_b64_to_jpeg_data_url(original_b64)
    processed_url = _normalize_b64_to_jpeg_data_url(processed_b64)

    expected = expected_view_category or "unknown"

    model = os.getenv("OPENAI_JUDGE_MODEL", os.getenv("OPENAI_METADATA_MODEL", "gpt-4o-mini"))
    client = OpenAI(api_key=api_key)

    prompt = {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": (
                    "You are a strict judge for an automotive image enhancement pipeline.\n\n"
                    "Task: Decide whether the PROCESSED image respects hard constraints compared to the ORIGINAL.\n\n"
                    f"Expected view_category: {expected}\n\n"
                    "Hard rules:\n"
                    "- No hallucinated framing: output must keep the same crop/zoom (no zoom-out).\n"
                    "- No hallucinated interior parts: if expected is interior, do NOT add new steering wheel/dashboard/screen/windows not present in original.\n"
                    "- If expected is exterior, do NOT remove car elements; keep finish metallic/glossy (avoid matte look).\n"
                    "- No extra objects (people, extra wheels, random symbols/letters).\n\n"
                    "Return ONLY JSON:\n"
                    '{\n'
                    '  \"verdict\": \"PASS\" | \"FAIL\",\n'
                    '  \"failed_constraints\": [\"constraint_key\", ...],\n'
                    '  \"reason\": \"short explanation\"\n'
                    '}\n'
                ),
            },
            {"type": "image_url", "image_url": {"url": original_url}},
            {"type": "image_url", "image_url": {"url": processed_url}},
        ],
    }

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": "Return ONLY valid JSON."}, prompt],
        temperature=0.1,
        max_tokens=450,
    )
    text = (resp.choices[0].message.content or "").strip()
    parsed = _extract_first_json_object(text) or {}
    verdict = str(parsed.get("verdict", "FAIL")).upper()
    reason = parsed.get("reason")
    if verdict not in ("PASS", "FAIL"):
        verdict = "FAIL"
    return verdict, (reason if isinstance(reason, str) else None)


@router.post("/judge", response_model=AdminJudgeResponse)
def admin_judge(body: AdminJudgeRequest, current_user: User = Depends(get_current_user)) -> AdminJudgeResponse:
    _require_superadmin(current_user)

    per_image: list[JudgeImageResult] = []
    failed_images: list[int] = []

    for img in body.images:
        aspect_ok, ratio = _check_aspect_ratio_4_3(img.processed_b64)
        failed_constraints: list[str] = []
        llm_verdict: str | None = None
        llm_reason: str | None = None

        if not aspect_ok:
            failed_constraints.append("aspect_ratio_4_3")

        final_verdict = aspect_ok
        if aspect_ok and body.use_llm_judge:
            llm_verdict, llm_reason = _llm_judge_pass_fail(
                original_b64=img.original_b64,
                processed_b64=img.processed_b64,
                expected_view_category=img.expected_view_category,
            )
            if llm_verdict != "PASS":
                failed_constraints.append("llm_judge_fail")
                final_verdict = False
            else:
                final_verdict = True

        result = JudgeImageResult(
            index=img.index,
            verdict=final_verdict,
            aspect_ratio=ratio,
            failed_constraints=failed_constraints,
            llm_verdict=llm_verdict,
            llm_reason=llm_reason,
        )
        per_image.append(result)
        if not final_verdict:
            failed_images.append(img.index)

    overall_pass = len(failed_images) == 0
    summary = "PASS" if overall_pass else "FAIL (see per-image details)"
    return AdminJudgeResponse(
        overall_pass=overall_pass,
        failed_images=failed_images,
        summary=summary,
        per_image=per_image,
    )


# --- Full Judge (baseline compare + likely prompt/node cause) ---


class FullJudgeImageInput(BaseModel):
    index: int
    original_b64: str
    current_processed_b64: str
    baseline_processed_b64: str
    metadata: dict = Field(default_factory=dict)
    expected_view_category: str | None = Field(None, max_length=32)


class AdminFullJudgeRequest(BaseModel):
    pipeline_version: str = Field(default="11", max_length=4)
    preview: bool = Field(default=False)
    expected_aspect_ratio: str = Field(default="4:3", max_length=16)
    images: list[FullJudgeImageInput]
    # Optional: used to help the LLM reason about studio lighting.
    target_studio_description: str | None = Field(None, max_length=5000)


class FullJudgeImageResult(BaseModel):
    index: int
    verdict: bool
    aspect_ratio: float | None = None
    failed_constraints: list[str] = Field(default_factory=list)
    llm_reason: str | None = None
    likely_node_or_prompt_cause: str | None = None
    recommended_changes: list[str] = Field(default_factory=list)


class AdminFullJudgeResponse(BaseModel):
    overall_pass: bool
    failed_images: list[int]
    summary: str | None = None
    per_image: list[FullJudgeImageResult]


def _prompt_control_hints(*, pipeline_version: str, view_category: str | None) -> str:
    """
    Hints to help the LLM map observed problems to likely nodes/prompts.
    Keep this small and factual.
    """
    vc = view_category or "exterior"
    if pipeline_version == "11":
        if vc == "exterior":
            return (
                "V11 exterior uses dynamic_prompt_node with instructions to swap background to studio, "
                "preserve metallic/glossy paint finish, remove unwanted reflections from hood/body "
                "(while matching studio lighting), and keep camera angle/crop and 4:3 aspect."
            )
        if vc == "interior":
            return (
                "V11 interior uses dynamic_prompt_node with instructions to swap only the background visible in the cabin, "
                "remove reflections on glossy interior surfaces, and never add new interior parts (no zoom-out / no new windows/steering parts)."
            )
        return "V11 detail uses dynamic_prompt_node with strict crop preservation and minimal edits for the selected component."
    return f"Pipeline {pipeline_version} uses dynamic prompts + edit nodes. Focus on which prompt branch was selected for view_category={vc}."


def _llm_full_compare_to_baseline(
    *,
    original_b64: str,
    current_processed_b64: str,
    baseline_processed_b64: str,
    expected_view_category: str | None,
    pipeline_version: str,
    target_studio_description: str | None = None,
) -> tuple[bool, list[str], str | None, str | None, list[str]]:
    """
    Returns:
      (verdict_pass, failed_constraints, llm_reason, likely_cause, recommended_changes)
    """
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        # Deterministic fallback: baseline compare can't be done.
        return True, [], "OPENAI_API_KEY not set; skipping full LLM compare.", None, []

    from openai import OpenAI

    original_url = _normalize_b64_to_jpeg_data_url(original_b64)
    current_url = _normalize_b64_to_jpeg_data_url(current_processed_b64)
    baseline_url = _normalize_b64_to_jpeg_data_url(baseline_processed_b64)

    expected = expected_view_category or "unknown"
    view_category_hint = expected
    hints = _prompt_control_hints(pipeline_version=pipeline_version, view_category=view_category_hint)

    studio_hint = (
        f"Target studio description (may include reflections/floor guidance): {target_studio_description[:1200]}..."
        if target_studio_description
        else "Target studio description: (not provided)"
    )

    model = os.getenv("OPENAI_JUDGE_MODEL", os.getenv("OPENAI_METADATA_MODEL", "gpt-4o-mini"))
    client = OpenAI(api_key=api_key)

    prompt = {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": (
                    "You are a strict QA engineer for an automotive image enhancement pipeline.\n\n"
                    "You will compare BASELINE (previous best) vs CURRENT output for the same ORIGINAL input.\n\n"
                    "Hard constraints to respect:\n"
                    "- Keep aspect ratio at 4:3 (fail if current is not 4:3).\n"
                    "- No zoom-out or framing changes (keep crop/zoom).\n"
                    "- Expected view_category must be respected: "
                    "if interior, do NOT add new dashboard/steering/screens/windows; "
                    "if exterior, do NOT remove car elements; keep paint finish metallic/glossy, but remove unwanted reflections from hood/body.\n"
                    "- No hallucinated extra objects/symbols/letters.\n"
                    "- Studio lighting consistency: reflections/shadows should match the studio.\n\n"
                    f"Expected view_category: {expected}\n"
                    f"{studio_hint}\n"
                    f"Prompt/node control hints: {hints}\n\n"
                    "Task:\n"
                    "1) Decide if CURRENT is PASS relative to hard constraints.\n"
                    "2) Identify the most likely cause: which prompt branch/node logic probably led to the difference vs BASELINE.\n"
                    "3) Provide recommended code/prompt changes (short bullet strings) to fix the pipeline.\n\n"
                    "Return ONLY JSON:\n"
                    '{\n'
                    '  "verdict": "PASS" | "FAIL",\n'
                    '  "failed_constraints": ["constraint_key", ...],\n'
                    '  "reason": "short explanation comparing baseline vs current",\n'
                    '  "likely_node_or_prompt_cause": "one sentence",\n'
                    '  "recommended_changes": ["change 1", "change 2"]\n'
                    "}\n"
                ),
            },
            {"type": "image_url", "image_url": {"url": original_url}},
            {"type": "image_url", "image_url": {"url": baseline_url}},
            {"type": "image_url", "image_url": {"url": current_url}},
        ],
    }

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": "Return ONLY valid JSON."}, prompt],
        temperature=0.1,
        max_tokens=700,
    )
    text = (resp.choices[0].message.content or "").strip()
    parsed = _extract_first_json_object(text) or {}

    verdict = str(parsed.get("verdict", "FAIL")).upper()
    verdict_pass = verdict == "PASS"
    failed_constraints = parsed.get("failed_constraints") or []
    if not isinstance(failed_constraints, list):
        failed_constraints = []
    llm_reason = parsed.get("reason") if isinstance(parsed.get("reason"), str) else None
    likely_cause = parsed.get("likely_node_or_prompt_cause") if isinstance(parsed.get("likely_node_or_prompt_cause"), str) else None
    recommended_changes = parsed.get("recommended_changes") or []
    if not isinstance(recommended_changes, list):
        recommended_changes = []

    return verdict_pass, failed_constraints, llm_reason, likely_cause, recommended_changes


@router.post("/judge/full", response_model=AdminFullJudgeResponse)
def admin_full_judge(body: AdminFullJudgeRequest, current_user: User = Depends(get_current_user)) -> AdminFullJudgeResponse:
    _require_superadmin(current_user)

    per_image: list[FullJudgeImageResult] = []
    failed_images: list[int] = []

    for img in body.images:
        aspect_ok, ratio = _check_aspect_ratio_4_3(img.current_processed_b64)
        failed_constraints: list[str] = []

        if not aspect_ok:
            failed_constraints.append("aspect_ratio_4_3")

        verdict_pass = aspect_ok
        llm_reason: str | None = None
        likely_cause: str | None = None
        recommended_changes: list[str] = []

        if aspect_ok:
            baseline_ok = bool(img.baseline_processed_b64)
            if baseline_ok:
                verdict_pass, llm_failed_constraints, llm_reason, likely_cause, recommended_changes = _llm_full_compare_to_baseline(
                    original_b64=img.original_b64,
                    current_processed_b64=img.current_processed_b64,
                    baseline_processed_b64=img.baseline_processed_b64,
                    expected_view_category=img.expected_view_category,
                    pipeline_version=body.pipeline_version,
                    target_studio_description=body.target_studio_description,
                )
                failed_constraints.extend([c for c in (llm_failed_constraints or []) if c not in failed_constraints])
            else:
                llm_reason = "No baseline_processed_b64 provided; skipping baseline compare."

        if not verdict_pass:
            failed_images.append(img.index)

        per_image.append(
            FullJudgeImageResult(
                index=img.index,
                verdict=verdict_pass,
                aspect_ratio=ratio,
                failed_constraints=failed_constraints,
                llm_reason=llm_reason,
                likely_node_or_prompt_cause=likely_cause,
                recommended_changes=recommended_changes,
            )
        )

    overall_pass = len(failed_images) == 0
    summary = "PASS" if overall_pass else "FAIL (see full judge details)"

    return AdminFullJudgeResponse(
        overall_pass=overall_pass,
        failed_images=failed_images,
        summary=summary,
        per_image=per_image,
    )
