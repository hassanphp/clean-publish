"""Webhook endpoints for Fal.ai and Replicate completion callbacks."""

import base64
import json
import logging
import urllib.request
from typing import Any

from fastapi import APIRouter, Request, Response

from app.database import SessionLocal
from app.models import AsyncJob, AsyncJobImage, AsyncJobImageStatus, AsyncJobStatus
from app.redis_client import publish_job_update
from app.utils import sanitize_error

logger = logging.getLogger(__name__)


def _apply_dealer_branding(
    processed_b64: str | None,
    metadata: dict,
    job: AsyncJob,
    db,
) -> str | None:
    """Apply all dealer branding overlays: corner logo, license plate, 3D wall."""
    if not processed_b64 or not job.dealer_id:
        logger.info("Branding skip: no processed_b64 or dealer_id")
        return processed_b64
    view_cat = metadata.get("view_category", "exterior")
    branding = {}
    if job.branding_options_json:
        try:
            branding = json.loads(job.branding_options_json)
        except json.JSONDecodeError:
            pass
    from sqlalchemy.orm import joinedload
    from app.models import Dealer, DealerAsset
    dealer = db.query(Dealer).options(joinedload(Dealer.assets)).filter(Dealer.id == job.dealer_id).first()
    if not branding and dealer and dealer.preferences:
        branding = {
            "logo_corner_enabled": dealer.preferences.logo_corner_enabled,
            "logo_corner_position": dealer.preferences.logo_corner_position or "right",
            "license_plate_enabled": dealer.preferences.license_plate_enabled,
            "logo_3d_wall_enabled": dealer.preferences.logo_3d_wall_enabled,
        }
    if not branding and dealer:
        branding = {"logo_corner_enabled": True, "logo_corner_position": "right", "license_plate_enabled": False, "logo_3d_wall_enabled": False}
    if not dealer or not dealer.assets:
        logger.info("Branding skip: dealer=%s has %s assets", dealer.id if dealer else None, len(dealer.assets) if dealer and dealer.assets else 0)
        return processed_b64
    logo_b64 = None
    license_plate_logo_b64 = None
    for a in dealer.assets:
        if a.asset_type == "logo" and a.data_b64:
            logo_b64 = f"data:image/png;base64,{a.data_b64}" if "," not in a.data_b64 else a.data_b64
        if a.asset_type == "license_plate" and a.data_b64:
            license_plate_logo_b64 = f"data:image/png;base64,{a.data_b64}" if "," not in a.data_b64 else a.data_b64
    lp_logo = license_plate_logo_b64 or logo_b64
    try:
        from app.branding import overlay_logo_corner, overlay_logo_license_plate, overlay_logo_wall
        if (branding.get("logo_corner_enabled") or branding.get("logo_corner")) and logo_b64:
            pos = branding.get("logo_corner_position", "right")
            processed_b64 = overlay_logo_corner(processed_b64, logo_b64, position=pos, view_category=view_cat)
        if branding.get("license_plate_enabled") and lp_logo and view_cat == "exterior" and job.pipeline_version not in ("6", "7", "11"):
            processed_b64 = overlay_logo_license_plate(processed_b64, lp_logo)
        if branding.get("logo_3d_wall_enabled") and logo_b64 and job.pipeline_version not in ("6", "7", "11"):
            processed_b64 = overlay_logo_wall(processed_b64, logo_b64)
        return processed_b64
    except Exception as e:
        logger.warning("Dealer branding overlay failed: %s", e)
        return processed_b64

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


def _url_to_b64(url: str) -> str:
    """Fetch image from URL and return base64 JPEG."""
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = resp.read()
    return base64.b64encode(data).decode()


# --- Fal.ai Webhook ---


@router.post("/fal")
async def webhook_fal(request: Request) -> Response:
    """
    Receive Fal.ai completion callback.
    Payload: { request_id, gateway_request_id, status, payload?, error? }
    """
    try:
        body = await request.body()
        data = json.loads(body) if body else {}
    except json.JSONDecodeError as e:
        logger.warning("Fal webhook: invalid JSON %s", e)
        return Response(status_code=400, content="Invalid JSON")

    request_id = data.get("request_id")
    status = data.get("status", "")
    payload_data = data.get("payload")
    error_msg = data.get("error", "")

    if not request_id:
        logger.warning("Fal webhook: missing request_id")
        return Response(status_code=400, content="Missing request_id")

    db = SessionLocal()
    try:
        job_image = db.query(AsyncJobImage).filter(
            AsyncJobImage.provider_job_id == request_id,
            AsyncJobImage.provider == "fal",
        ).first()

        if not job_image:
            logger.warning("Fal webhook: unknown request_id %s", request_id)
            return Response(status_code=200)  # Idempotent - accept to avoid retries

        job = job_image.job

        if status == "OK" and payload_data:
            try:
                images = payload_data.get("images", [])
                if images:
                    img_info = images[0]
                    url = img_info.get("url") if isinstance(img_info, dict) else getattr(img_info, "url", None)
                    if url:
                        job_image.processed_b64 = _url_to_b64(url)
                        job_image.status = AsyncJobImageStatus.COMPLETED
                        job_image.error_message = None
                    else:
                        job_image.status = AsyncJobImageStatus.FAILED
                        job_image.error_message = "Image payload has no URL"
                else:
                    job_image.status = AsyncJobImageStatus.FAILED
                    job_image.error_message = "No images in payload"
            except Exception as e:
                logger.exception("Fal webhook: failed to process payload")
                job_image.status = AsyncJobImageStatus.FAILED
                job_image.error_message = sanitize_error(str(e))
        else:
            job_image.status = AsyncJobImageStatus.FAILED
            job_image.error_message = sanitize_error(error_msg or "Processing failed")

        db.commit()

        # Build result for SSE
        meta = {}
        if job_image.metadata_json:
            try:
                meta = json.loads(job_image.metadata_json)
            except json.JSONDecodeError:
                pass

        processed_b64 = job_image.processed_b64 or ""
        if processed_b64 and job_image.status == AsyncJobImageStatus.COMPLETED:
            overlay_b64 = _apply_dealer_branding(processed_b64, meta, job, db)
            if overlay_b64:
                job_image.processed_b64 = overlay_b64
                db.commit()

        result_data: dict[str, Any] = {
            "index": job_image.image_index,
            "original_b64": job_image.original_b64 or "",
            "processed_b64": job_image.processed_b64 or "",
            "metadata": meta,
        }

        await publish_job_update(job.id, "result", result_data)

        # Check if all images done
        remaining = db.query(AsyncJobImage).filter(
            AsyncJobImage.job_id == job.id,
            AsyncJobImage.status.in_([AsyncJobImageStatus.PENDING, AsyncJobImageStatus.PROCESSING]),
        ).count()
        if remaining == 0:
            failed = db.query(AsyncJobImage).filter(
                AsyncJobImage.job_id == job.id,
                AsyncJobImage.status == AsyncJobImageStatus.FAILED,
            ).all()
            job.status = AsyncJobStatus.COMPLETED if not failed else AsyncJobStatus.FAILED
            if failed:
                errs = [f.image_index for f in failed]
                first_err = failed[0].error_message or "Unknown"
                job.error_message = f"Image(s) {errs} failed: {first_err}"
            db.commit()
            complete_data = {"status": job.status.value}
            if job.error_message:
                complete_data["error"] = job.error_message
            await publish_job_update(job.id, "complete", complete_data)

    finally:
        db.close()

    return Response(status_code=200)


# --- Replicate Webhook ---


@router.post("/replicate")
async def webhook_replicate(request: Request) -> Response:
    """
    Receive Replicate completion callback.
    Body is the prediction object: { id, status, output?, error? }
    """
    try:
        body = await request.body()
        data = json.loads(body) if body else {}
    except json.JSONDecodeError as e:
        logger.warning("Replicate webhook: invalid JSON %s", e)
        return Response(status_code=400, content="Invalid JSON")

    prediction_id = data.get("id")
    status = data.get("status", "")
    output = data.get("output")
    error_msg = data.get("error") or data.get("logs") or ""

    if not prediction_id:
        logger.warning("Replicate webhook: missing id")
        return Response(status_code=400, content="Missing id")

    # Only process terminal states
    if status not in ("succeeded", "failed", "canceled"):
        return Response(status_code=200)

    db = SessionLocal()
    try:
        job_image = db.query(AsyncJobImage).filter(
            AsyncJobImage.provider_job_id == str(prediction_id),
            AsyncJobImage.provider == "replicate",
        ).first()

        if not job_image:
            logger.warning("Replicate webhook: unknown prediction_id %s", prediction_id)
            return Response(status_code=200)

        job = job_image.job

        if status == "succeeded" and output is not None:
            try:
                # Flux 2 Pro: output can be a direct URL string, or list of URLs/FileOutputs
                item = output[0] if isinstance(output, (list, tuple)) and output else output
                url = None
                if isinstance(item, str) and item.startswith(("http://", "https://")):
                    url = item
                elif isinstance(item, dict):
                    url = item.get("url") or item.get("uri")
                elif hasattr(item, "url"):
                    url = getattr(item, "url", None)
                    if callable(url):
                        url = url()

                if url:
                    job_image.processed_b64 = _url_to_b64(url)
                    job_image.status = AsyncJobImageStatus.COMPLETED
                    job_image.error_message = None
                else:
                    job_image.status = AsyncJobImageStatus.FAILED
                    job_image.error_message = "Output has no image URL"
                    logger.warning("Replicate webhook: no URL in output, output type=%s", type(output).__name__)
            except Exception as e:
                logger.exception("Replicate webhook: failed to process output: %s", e)
                job_image.status = AsyncJobImageStatus.FAILED
                job_image.error_message = sanitize_error(str(e))
        else:
            job_image.status = AsyncJobImageStatus.FAILED
            err = str(error_msg)[:500] if error_msg else f"Processing status: {status}"
            job_image.error_message = sanitize_error(err)
            logger.info("Replicate webhook: prediction %s failed, status=%s error=%s", prediction_id, status, err[:200])

        db.commit()

        meta = {}
        if job_image.metadata_json:
            try:
                meta = json.loads(job_image.metadata_json)
            except json.JSONDecodeError:
                pass

        processed_b64 = job_image.processed_b64 or ""
        if processed_b64 and job_image.status == AsyncJobImageStatus.COMPLETED:
            overlay_b64 = _apply_dealer_branding(processed_b64, meta, job, db)
            if overlay_b64:
                job_image.processed_b64 = overlay_b64
                db.commit()

        result_data = {
            "index": job_image.image_index,
            "original_b64": job_image.original_b64 or "",
            "processed_b64": job_image.processed_b64 or "",
            "metadata": meta,
            "error_message": job_image.error_message,
        }

        await publish_job_update(job.id, "result", result_data)

        remaining = db.query(AsyncJobImage).filter(
            AsyncJobImage.job_id == job.id,
            AsyncJobImage.status.in_([AsyncJobImageStatus.PENDING, AsyncJobImageStatus.PROCESSING]),
        ).count()
        if remaining == 0:
            failed_list = db.query(AsyncJobImage).filter(
                AsyncJobImage.job_id == job.id,
                AsyncJobImage.status == AsyncJobImageStatus.FAILED,
            ).all()
            job.status = AsyncJobStatus.COMPLETED if not failed_list else AsyncJobStatus.FAILED
            if failed_list:
                errs = [f.image_index for f in failed_list]
                first_err = failed_list[0].error_message or "Unknown"
                job.error_message = f"Image(s) {errs} failed: {first_err}"
            db.commit()
            complete_data = {"status": job.status.value}
            if job.error_message:
                complete_data["error"] = job.error_message
            await publish_job_update(job.id, "complete", complete_data)

    finally:
        db.close()

    return Response(status_code=200)
