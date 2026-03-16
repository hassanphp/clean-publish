"""FastAPI application with SSE endpoint for batch image processing."""

import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google.auth import default as google_auth_default
from google.auth.transport.requests import Request as AuthRequest

from app.async_job_service import submit_async_job
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db, init_db
from app.graph.graph import create_graph
from app.models import AsyncJob, AsyncJobImage, AsyncJobImageStatus, AsyncJobStatus, User
from app.redis_client import subscribe_job_updates
from app.routers import webhooks, dealers, auth, projects, storage, billing
from app.routers.auth import get_current_user
from app.schemas import ProcessBatchRequest, RegenerateRequest, AutomotiveImageMetadata

load_dotenv()


async def get_access_token() -> str:
    """Get OAuth2 access token for Vertex AI (uses ADC)."""
    credentials, _ = google_auth_default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    credentials.refresh(AuthRequest())
    return credentials.token


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: ensure DB exists and schema is up to date."""
    init_db()
    try:
        from app.seed import ensure_schema
        ensure_schema()
    except Exception:
        pass  # Non-SQLite or schema already current
    yield
    # Shutdown
    pass


app = FastAPI(
    title="Automotive Image Processing API",
    version="1.0.0",
    lifespan=lifespan,
)

_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://bismillah-image-ai-frontend-jgdgtnysta-uc.a.run.app",
    "https://api.carveo.eu",
    "https://carveo.eu",
    "https://www.carveo.eu",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router)
app.include_router(dealers.router)
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(storage.router)
app.include_router(billing.router)


def _is_gcs_url(s: str) -> bool:
    """Check if string is a GCS URL (not base64)."""
    return s.startswith("https://storage.googleapis.com/") or s.startswith("gs://")


async def _fetch_gcs_to_b64(url: str) -> str:
    """Fetch image from GCS URL (https://storage.googleapis.com/... or gs://...) and return base64."""
    import base64
    try:
        from google.cloud import storage
    except ImportError:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as r:
                r.raise_for_status()
                data = await r.read()
                return base64.b64encode(data).decode("ascii")

    if url.startswith("gs://"):
        parts = url.replace("gs://", "").split("/", 1)
    elif "storage.googleapis.com" in url:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path_parts = parsed.path.lstrip("/").split("/", 1)
        parts = path_parts if len(path_parts) == 2 else (path_parts[0], "")
    else:
        raise ValueError(f"Unsupported GCS URL: {url}")

    bucket_name, blob_path = parts[0], parts[1] if len(parts) > 1 else ""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    data = blob.download_as_bytes()
    return base64.b64encode(data).decode("ascii")


def _parse_images(images: list[str]) -> list[dict]:
    """
    Parse base64 or GCS URLs into ImageItem format.
    For GCS URLs: pass image_url directly (no base64 fetch). Fal/Replicate download from URL.
    For base64: use bytes_b64. Classifier fetches GCS when needed (one at a time).
    """
    from app.utils.storage import generate_signed_read_url

    items = []
    for i, img in enumerate(images):
        if _is_gcs_url(img):
            # Private bucket: use signed read URL. Public: use as-is.
            signed = generate_signed_read_url(img)
            url = signed if signed else img
            items.append({
                "index": i,
                "bytes_b64": "",
                "mime_type": "image/jpeg",
                "image_url": url,
            })
        else:
            b64 = img.split(",", 1)[1] if "," in img else img
            items.append({"index": i, "bytes_b64": b64, "mime_type": "image/jpeg"})
    return items


def sse_format(event: str, data: dict) -> str:
    """Format SSE message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _load_dealer_branding(dealer_id: int | None, branding_options: dict | None) -> dict | None:
    """Load dealer preferences and logo asset. Merge with branding_options overrides."""
    if not dealer_id:
        if not branding_options:
            return None
        # Ensure license_plate_logo_b64 when only logo_b64 provided (user-uploaded branding)
        opts = dict(branding_options)
        if opts.get("logo_b64") and not opts.get("license_plate_logo_b64"):
            opts["license_plate_logo_b64"] = opts["logo_b64"]
        return opts
    db = SessionLocal()
    try:
        from sqlalchemy.orm import joinedload
        from app.models import Dealer, DealerAsset
        dealer = db.query(Dealer).options(joinedload(Dealer.assets)).filter(Dealer.id == dealer_id).first()
        if not dealer:
            return None
        prefs = dealer.preferences
        opts = {}
        if prefs:
            opts["logo_corner_enabled"] = prefs.logo_corner_enabled
            opts["logo_corner_position"] = prefs.logo_corner_position or "right"
            opts["license_plate_enabled"] = prefs.license_plate_enabled
            opts["logo_3d_wall_enabled"] = prefs.logo_3d_wall_enabled
        else:
            opts["logo_corner_enabled"] = True
            opts["logo_corner_position"] = "right"
            opts["license_plate_enabled"] = False
            opts["logo_3d_wall_enabled"] = False
        logo_b64 = None
        license_plate_logo_b64 = None
        for a in dealer.assets or []:
            if a.asset_type == "logo" and a.data_b64:
                logo_b64 = a.data_b64
                if "," not in logo_b64:
                    logo_b64 = f"data:image/png;base64,{logo_b64}"
            if a.asset_type == "license_plate" and a.data_b64:
                license_plate_logo_b64 = a.data_b64
                if "," not in license_plate_logo_b64:
                    license_plate_logo_b64 = f"data:image/png;base64,{license_plate_logo_b64}"
        opts["logo_b64"] = logo_b64
        opts["license_plate_logo_b64"] = license_plate_logo_b64 or logo_b64
        if branding_options:
            opts.update(branding_options)
        return opts
    finally:
        db.close()


@app.post("/api/v1/process-batch")
async def process_batch(
    request: ProcessBatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Process a batch of images through the LangGraph pipeline.
    Streams progress via Server-Sent Events.
    Requires JWT. Deducts credits before processing.
    """
    if not request.images:
        raise HTTPException(status_code=400, detail="At least one image is required")

    image_count = len(request.images)
    user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user_credits = getattr(user, "credits", 0) or 0
    if user_credits < image_count:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need {image_count}, have {user_credits}.",
        )
    user.credits = user_credits - image_count
    db.commit()

    target_description = request.target_studio_description
    studio_analysis_log = None
    # V6: prefer studio_reference_data_uri; fallback to studio_reference_image
    studio_b64 = (
        request.studio_reference_data_uri
        or request.studio_reference_image
    )
    pipeline_version = getattr(request, "pipeline_version", "11") or "11"
    if studio_b64:
        from app.studio_analyzer import analyze_studio_image
        studio_analysis_log = "Analyzing studio reference..."
        target_description = analyze_studio_image(studio_b64, force_openai=(pipeline_version == "11"))

    # V6/V7/V11 can work with a default prompt if no text extracted; V1-V5, V8 need target_description
    if pipeline_version not in ("6", "7", "11") and not target_description:
        raise HTTPException(status_code=400, detail="Could not extract studio description")
    if pipeline_version in ("6", "7", "11") and not target_description:
        target_description = (
            "Professional automotive photography studio. Match the lighting, "
            "reflections, shadows, floor, and background from the reference image. "
            "Photorealistic result."
        )

    images = _parse_images(request.images)
    branding = _load_dealer_branding(request.dealer_id, request.branding_options)

    # V6/V7 with webhook: return job_id immediately, client subscribes to /jobs/{job_id}/stream
    use_webhook = pipeline_version in ("6", "7") and os.getenv("SERVER_BASE_URL")
    if use_webhook:
        try:
            # Store only options (no logo_b64, no license_plate_logo_b64) for webhook; loaded from dealer in webhook
            branding_for_job = None
            if branding:
                branding_for_job = {k: v for k, v in branding.items() if k not in ("logo_b64", "license_plate_logo_b64")}
            job_id = await submit_async_job(
                images=images,
                target_studio_description=target_description,
                pipeline_version=pipeline_version,
                studio_reference_b64=studio_b64,
                dealer_id=request.dealer_id,
                branding_options=branding_for_job,
                dealer_branding=branding,
            )
            from fastapi.responses import JSONResponse
            return JSONResponse(content={"job_id": job_id})
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    initial_state = {
        "images": images,
        "target_studio_description": target_description,
        "pipeline_version": pipeline_version,
        "studio_reference_b64": studio_b64,
        "metadata": [],
        "vertex_payloads": [],
        "results": [],
        "logs": [],
        "error": None,
    }

    async def event_generator():
        try:
            if studio_analysis_log:
                yield sse_format("log", {"message": studio_analysis_log})
                yield sse_format("log", {"message": "  → Studio environment extracted"})

            graph = create_graph(get_access_token)
            config = {"configurable": {"thread_id": str(uuid.uuid4())}}

            dealer_branding = None
            if branding and pipeline_version in ("6", "7", "11") and (branding.get("logo_3d_wall_enabled") or branding.get("license_plate_enabled")):
                dealer_branding = branding
            for img_item in images:
                single_image_state = {
                    "images": [img_item],
                    "target_studio_description": target_description,
                    "pipeline_version": pipeline_version,
                    "studio_reference_b64": studio_b64,
                    "dealer_branding": dealer_branding,
                    "metadata": [],
                    "vertex_payloads": [],
                    "results": [],
                    "logs": [],
                    "error": None,
                }
                final_state = None
                async for event in graph.astream(
                    single_image_state,
                    config=config,
                    stream_mode="updates",
                ):
                    for node_name, state_update in event.items():
                        logs = state_update.get("logs", [])
                        for log in logs:
                            yield sse_format("log", {"message": log})
                        final_state = state_update

                results = (final_state or {}).get("results", [])
                for r in results:
                    meta = r.get("metadata")
                    meta_dict = meta.model_dump() if hasattr(meta, "model_dump") else (meta or {})
                    processed_b64 = r.get("processed_b64", "")
                    view_cat = meta_dict.get("view_category", "exterior") if isinstance(meta_dict, dict) else getattr(meta, "view_category", "exterior")
                    if branding and processed_b64:
                        try:
                            from app.branding import overlay_logo_corner, overlay_logo_license_plate, overlay_logo_wall
                            logo_b64 = branding.get("logo_b64")
                            lp_logo = branding.get("license_plate_logo_b64") or logo_b64
                            if branding.get("logo_corner_enabled") or branding.get("logo_corner"):
                                if logo_b64:
                                    pos = branding.get("logo_corner_position", "right")
                                    processed_b64 = overlay_logo_corner(processed_b64, logo_b64, position=pos, view_category=view_cat)
                            if branding.get("license_plate_enabled") and lp_logo and view_cat in ("exterior",) and pipeline_version not in ("6", "7", "11"):
                                processed_b64 = overlay_logo_license_plate(processed_b64, lp_logo)
                            if branding.get("logo_3d_wall_enabled") and logo_b64 and pipeline_version not in ("6", "7", "11"):
                                processed_b64 = overlay_logo_wall(processed_b64, logo_b64)
                        except Exception:
                            pass
                    result_item = {
                        "index": r["index"],
                        "original_b64": r.get("original_b64", ""),
                        "processed_b64": processed_b64,
                        "metadata": meta_dict if isinstance(meta_dict, dict) else (meta.model_dump() if hasattr(meta, "model_dump") else {}),
                        "error_message": r.get("error_message"),
                        "model_info": r.get("model_info"),
                    }
                    yield sse_format("result", result_item)

            yield sse_format("complete", {"status": "completed", "target_studio_description": target_description})

        except Exception as e:
            yield sse_format("error", {"message": str(e)})
            yield sse_format("complete", {"status": "failed", "error": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/v1/jobs/{job_id}/stream")
async def job_stream(job_id: str):
    """
    SSE stream for async job (V6/V7) updates.
    Sends: log, result, complete.
    """
    db = SessionLocal()
    try:
        job = db.query(AsyncJob).filter(AsyncJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
    finally:
        db.close()

    async def event_generator():
        db = SessionLocal()
        try:
            # Send any already-completed/failed results (for late joiners)
            done_images = (
                db.query(AsyncJobImage)
                .filter(
                    AsyncJobImage.job_id == job_id,
                    AsyncJobImage.status.in_([AsyncJobImageStatus.COMPLETED, AsyncJobImageStatus.FAILED]),
                )
                .order_by(AsyncJobImage.image_index)
                .all()
            )
            for ji in done_images:
                meta = {}
                if ji.metadata_json:
                    try:
                        meta = json.loads(ji.metadata_json)
                    except json.JSONDecodeError:
                        pass
                yield sse_format("result", {
                    "index": ji.image_index,
                    "original_b64": ji.original_b64 or "",
                    "processed_b64": ji.processed_b64 or "",
                    "metadata": meta,
                    "error_message": ji.error_message,
                })

            job_refresh = db.query(AsyncJob).filter(AsyncJob.id == job_id).first()
            if job_refresh and job_refresh.status in (AsyncJobStatus.COMPLETED, AsyncJobStatus.FAILED):
                complete_data = {"status": job_refresh.status.value}
                if job_refresh.error_message:
                    complete_data["error"] = job_refresh.error_message
                yield sse_format("complete", complete_data)
                return
        finally:
            db.close()

        # Stream live updates from Redis
        async for event, data in subscribe_job_updates(job_id):
            yield sse_format(event, data)
            if event == "complete":
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/v1/regenerate")
async def regenerate_image(request: RegenerateRequest):
    """
    Regenerate a single image with a different model (fal, replicate, or vertex).
    Uses metadata from the original result to preserve edit context.
    """
    from app.graph.nodes import dynamic_prompt_node, vertex_execution_node_async

    orig_b64 = request.original_b64
    if "," in orig_b64:
        orig_b64 = orig_b64.split(",", 1)[1]
    meta_dict = request.metadata
    meta = AutomotiveImageMetadata(
        view_category=meta_dict.get("view_category", "exterior"),
        components=meta_dict.get("components", []),
        existing_lighting=meta_dict.get("existing_lighting", "unknown"),
        dominant_color=meta_dict.get("dominant_color", "unknown"),
        suggested_edit_mode=meta_dict.get("suggested_edit_mode", "product-image"),
    )
    studio_b64 = request.studio_reference_data_uri
    if request.pipeline_version in ("6", "7", "11") and not studio_b64:
        raise HTTPException(
            status_code=400,
            detail="V6, V7 and V11 require studio_reference_data_uri for regeneration",
        )

    state = {
        "images": [{"index": 0, "bytes_b64": orig_b64, "mime_type": "image/jpeg"}],
        "metadata": [(0, meta)],
        "target_studio_description": request.target_studio_description,
        "pipeline_version": request.pipeline_version,
        "studio_reference_b64": studio_b64,
        "dealer_branding": None,
        "model_override": request.model,
        "vertex_payloads": [],
        "results": [],
        "logs": [],
        "error": None,
    }
    state = dynamic_prompt_node(state)
    payloads = state.get("vertex_payloads", [])
    if not payloads:
        raise HTTPException(status_code=400, detail="Could not build edit payload")
    state["vertex_payloads"] = payloads

    final = await vertex_execution_node_async(state, get_access_token)
    results = final.get("results", [])
    if not results:
        raise HTTPException(status_code=500, detail="Regeneration produced no result")
    r = results[0]
    processed_b64 = r.get("processed_b64", "")
    if not processed_b64:
        raise HTTPException(
            status_code=500,
            detail=r.get("error_message", "Regeneration failed"),
        )
    return {
        "processed_b64": processed_b64,
        "model_info": r.get("model_info"),
    }


@app.post("/api/v1/analyze-images")
async def analyze_images(request: dict):
    """Analyze images to get view_category and metadata (OpenAI or Gemini)."""
    images_b64 = request.get("images", [])
    if not images_b64:
        raise HTTPException(status_code=400, detail="At least one image is required")

    import os
    from app.graph.nodes import _get_genai_client, _classify_single_image, _classify_single_image_openai
    from app.schemas import AutomotiveImageMetadata

    provider = os.getenv("METADATA_PROVIDER", os.getenv("GEMINI_PROVIDER", "vertex")).lower()
    use_openai = provider == "openai"
    client = _get_genai_client() if not use_openai else None
    results = []
    for i, img in enumerate(images_b64):
        b64 = img.split(",", 1)[1] if "," in img else img
        try:
            meta = _classify_single_image_openai(b64, i) if use_openai else _classify_single_image(client, b64, i)
            results.append({"index": i, "metadata": meta.model_dump()})
        except Exception:
            results.append({
                "index": i,
                "metadata": AutomotiveImageMetadata(
                    view_category="exterior",
                    components=[],
                    existing_lighting="unknown",
                    dominant_color="unknown",
                    suggested_edit_mode="product-image",
                ).model_dump(),
            })
    return {"results": results}


@app.get("/")
def root():
    return {
        "service": "Carveo API",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
