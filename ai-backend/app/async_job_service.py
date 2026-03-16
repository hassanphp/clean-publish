"""Async job submission for V6/V7 with webhook callbacks."""

import asyncio
import json
import logging
import os
import uuid
from typing import Any

from replicate.exceptions import ReplicateError

from app.database import SessionLocal
from app.graph.nodes import (
    gemini_classifier_node,
    dynamic_prompt_node,
    _resize_for_flux_pro,
    FAL_FLUX_EDIT_MODEL,
    REPLICATE_STUDIO_MODEL,
)
from app.graph.state import GraphState
from app.models import AsyncJob, AsyncJobImage, AsyncJobImageStatus, AsyncJobStatus
from app.redis_client import publish_job_update

logger = logging.getLogger(__name__)


def _build_state(
    images: list[dict],
    target_studio_description: str,
    pipeline_version: str,
    studio_reference_b64: str | None,
    dealer_branding: dict | None = None,
) -> dict:
    """Build graph state and run classify + prompt nodes to get vertex_payloads."""
    state: GraphState = {
        "images": images,
        "target_studio_description": target_studio_description,
        "pipeline_version": pipeline_version,
        "studio_reference_b64": studio_reference_b64,
        "metadata": [],
        "vertex_payloads": [],
        "results": [],
        "logs": [],
        "error": None,
    }
    classify_out = gemini_classifier_node(state)
    state = {**state, **classify_out}
    prompt_out = dynamic_prompt_node(state)
    state = {**state, **prompt_out}
    payloads = state.get("vertex_payloads", [])
    if dealer_branding and dealer_branding.get("logo_b64") and (dealer_branding.get("logo_3d_wall_enabled") or dealer_branding.get("license_plate_enabled")):
        logo_b64 = dealer_branding["logo_b64"]
        instructions = []
        if dealer_branding.get("logo_3d_wall_enabled"):
            instructions.append("Place the dealer logo from the third reference image on the studio backdrop wall behind the car in realistic 3D perspective as a physical sign. Do NOT place it on the car or windows.")
        if dealer_branding.get("license_plate_enabled"):
            instructions.append("Clean the license plate area and place the dealer logo from the third reference image on it, sized to fit the plate.")
        branding_instruction = " " + " ".join(instructions)
        for p in payloads:
            meta = p.get("metadata")
            view = getattr(meta, "view_category", None) if meta else None
            if view == "exterior":
                p["prompt"] = p.get("prompt", "") + branding_instruction
                p["dealer_logo_b64"] = logo_b64
    return state


def _build_fal_args(payload: dict, studio_b64: str, logo_b64: str | None = None) -> dict[str, Any]:
    """Build Fal.ai FLUX submit arguments from a vertex payload."""
    import base64
    from PIL import Image

    base_b64 = payload["base_image_b64"]
    if "," in base_b64:
        base_b64 = base_b64.split(",", 1)[1]
    car_data_uri = f"data:image/jpeg;base64,{base_b64}"

    if studio_b64.startswith("data:"):
        studio_data_uri = studio_b64
    else:
        studio_raw = studio_b64.split(",", 1)[1] if "," in studio_b64 else studio_b64
        studio_data_uri = f"data:image/jpeg;base64,{studio_raw}"

    image_urls = [car_data_uri, studio_data_uri]
    if logo_b64:
        if logo_b64.startswith("data:"):
            logo_uri = logo_b64
        else:
            logo_raw = logo_b64.split(",", 1)[1] if "," in logo_b64 else logo_b64
            logo_uri = f"data:image/png;base64,{logo_raw}"
        image_urls.append(logo_uri)
    image_size = "auto"
    meta = payload.get("metadata")
    view = getattr(meta, "view_category", None) if meta else None
    if view in ("exterior", "detail"):
        try:
            import io
            img_bytes = base64.b64decode(base_b64)
            w, h = Image.open(io.BytesIO(img_bytes)).size
            image_size = {"width": w, "height": h}
        except Exception:
            pass

    args: dict[str, Any] = {
        "prompt": payload["prompt"],
        "image_urls": image_urls,
        "guidance_scale": 4.0,
        "num_inference_steps": 32,
        "output_format": "jpeg",
    }
    if image_size != "auto":
        args["image_size"] = image_size
    return args


def _build_replicate_input(payload: dict, studio_b64: str, logo_b64: str | None = None) -> dict[str, Any]:
    """Build Replicate Flux 2 Pro input from a vertex payload.
    Use data URIs (<1MB) to avoid E006 URL/encoding issues."""
    import base64

    car_bytes = _resize_for_flux_pro(payload["base_image_b64"])
    studio_bytes = _resize_for_flux_pro(studio_b64)

    car_uri = f"data:image/jpeg;base64,{base64.b64encode(car_bytes).decode()}"
    studio_uri = f"data:image/jpeg;base64,{base64.b64encode(studio_bytes).decode()}"
    input_images = [car_uri, studio_uri]
    if logo_b64:
        logo_raw = logo_b64.split(",", 1)[1] if "," in logo_b64 else logo_b64
        logo_bytes = _resize_for_flux_pro(logo_raw)
        logo_uri = f"data:image/jpeg;base64,{base64.b64encode(logo_bytes).decode()}"
        input_images.append(logo_uri)

    return {
        "prompt": payload["prompt"],
        "input_images": input_images,
        "aspect_ratio": "match_input_image",
        "safety_tolerance": 5,
    }


async def submit_async_job(
    images: list[dict],
    target_studio_description: str,
    pipeline_version: str,
    studio_reference_b64: str,
    dealer_id: int | None = None,
    branding_options: dict | None = None,
    dealer_branding: dict | None = None,
) -> str:
    """
    Create AsyncJob, run classify+prompt, submit each image to Fal (V6) or Replicate (V7) with webhook.
    Returns job_id (UUID).
    """
    server_base = os.getenv("SERVER_BASE_URL", "").rstrip("/")
    if not server_base:
        raise ValueError("SERVER_BASE_URL must be set for async webhook mode (e.g. https://your-app.ngrok.io)")

    state = _build_state(
        images, target_studio_description, pipeline_version, studio_reference_b64,
        dealer_branding=dealer_branding,
    )
    payloads = state.get("vertex_payloads", [])
    if not payloads:
        raise ValueError("No vertex payloads generated")

    job_id = str(uuid.uuid4())
    db = SessionLocal()
    try:
        branding_json = json.dumps(branding_options) if branding_options else None
        job = AsyncJob(
            id=job_id,
            status=AsyncJobStatus.PROCESSING,
            pipeline_version=pipeline_version,
            target_studio_description=target_studio_description,
            dealer_id=dealer_id,
            branding_options_json=branding_json,
        )
        db.add(job)

        img_by_idx = {img["index"]: img for img in images}
        webhook_fal = f"{server_base}/api/v1/webhooks/fal"
        webhook_replicate = f"{server_base}/api/v1/webhooks/replicate"

        for p in payloads:
            meta = p.get("metadata")
            meta_json = meta.model_dump() if hasattr(meta, "model_dump") else {}
            orig_b64 = img_by_idx.get(p["index"], {}).get("bytes_b64", p["base_image_b64"])

            job_image = AsyncJobImage(
                job_id=job_id,
                image_index=p["index"],
                provider_job_id=None,
                provider=pipeline_version == "6" and "fal" or "replicate",
                status=AsyncJobImageStatus.PROCESSING,
                original_b64=orig_b64,
                metadata_json=json.dumps(meta_json),
            )
            db.add(job_image)
            db.flush()

            if pipeline_version == "6":
                import fal_client
                logo_b64 = p.get("dealer_logo_b64") if isinstance(p, dict) else None
                args = _build_fal_args(p, studio_reference_b64, logo_b64=logo_b64)
                handler = await fal_client.submit_async(
                    FAL_FLUX_EDIT_MODEL,
                    arguments=args,
                    webhook_url=webhook_fal,
                )
                provider_id = getattr(handler, "request_id", None) or str(handler)
                job_image.provider_job_id = provider_id
            else:
                import replicate
                logo_b64 = p.get("dealer_logo_b64") if isinstance(p, dict) else None
                inp = _build_replicate_input(p, studio_reference_b64, logo_b64=logo_b64)
                owner, name = REPLICATE_STUDIO_MODEL.split("/", 1)
                # Rate limit: 6/min with burst 1 when credit < $5. Space submissions.
                if p is not payloads[0]:
                    await asyncio.sleep(11)
                for attempt in range(4):
                    try:
                        prediction = replicate.models.predictions.create(
                            model=(owner, name),
                            input=inp,
                            webhook=webhook_replicate,
                            webhook_events_filter=["completed"],
                        )
                        break
                    except ReplicateError as e:
                        if getattr(e, "status", None) == 429 and attempt < 3:
                            wait = (10, 20, 40)[attempt]
                            logger.warning("Replicate 429 rate limit, retrying in %ds (attempt %d/4)", wait, attempt + 1)
                            await asyncio.sleep(wait)
                        else:
                            raise
                job_image.provider_job_id = prediction.id

        db.commit()
        await publish_job_update(job_id, "log", {"message": f"Submitted {len(payloads)} image(s) for processing"})
    except Exception as e:
        db.rollback()
        logger.exception("Async job submission failed")
        raise
    finally:
        db.close()

    return job_id
