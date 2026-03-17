"""LangGraph nodes: Gemini classifier, dynamic prompt, Vertex/Replicate execution."""

import base64
import io
import json
import logging
import os
import tempfile
import asyncio
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential
from pydantic import ValidationError

from app.graph.state import GraphState, ImageItem, VertexPayload
from app.schemas import AutomotiveImageMetadata
from app.utils import sanitize_error

# Replicate model for image editing (no Vertex quota; pay-per-use)
REPLICATE_EDIT_MODEL = os.getenv("REPLICATE_EDIT_MODEL", "reve/edit-fast")
REMOVE_BG_MODEL = os.getenv(
    "REMOVE_BG_MODEL",
    "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
)
# V6: Fal.ai FLUX multi-image reference (studio adoption)
FAL_FLUX_EDIT_MODEL = os.getenv("FAL_FLUX_EDIT_MODEL", "fal-ai/flux-2-flex/edit")
# V7: Replicate Flux 2 Pro - multi-image reference for studio adoption
REPLICATE_STUDIO_MODEL = os.getenv("REPLICATE_STUDIO_MODEL", "black-forest-labs/flux-2-pro")

# V8: Vertex Imagen safe queue - global lock to throttle to ~15 RPM (avoid 429)
VERTEX_V8_LOCK = asyncio.Semaphore(1)


def _resize_for_flux_pro(b64_str: str, max_pixels: int = 2_000_000, max_bytes: int = 900_000) -> bytes:
    """Resize image for Flux 2 Pro: under max_pixels (9MP total) and max_bytes (for data URI <1MB)."""
    try:
        raw = b64_str.split(",", 1)[-1] if "," in b64_str else b64_str
        img_bytes = base64.b64decode(raw)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return img_bytes
        h, w = img.shape[:2]
        scale = 1.0
        if h * w > max_pixels:
            scale = (max_pixels / (h * w)) ** 0.5
        new_w = max(256, min(2048, int(w * scale)))
        new_h = max(256, min(2048, int(h * scale)))
        new_w = (new_w // 32) * 32
        new_h = (new_h // 32) * 32
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        # Encode with quality to stay under max_bytes for data URI
        for q in [85, 75, 65, 55]:
            _, buf = cv2.imencode(".jpg", resized, [cv2.IMWRITE_JPEG_QUALITY, q])
            if len(buf.tobytes()) <= max_bytes:
                return buf.tobytes()
        _, buf = cv2.imencode(".jpg", resized)
        return buf.tobytes()
    except Exception:
        raw = b64_str.split(",", 1)[-1] if "," in b64_str else b64_str
        return base64.b64decode(raw)


def _crop_to_aspect_ratio_4_3(b64_str: str) -> str:
    """Crop image center to 4:3 aspect ratio. Returns base64 JPEG."""
    try:
        img_bytes = base64.b64decode(b64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return b64_str
        h, w = img.shape[:2]
        target_ratio = 4 / 3
        current_ratio = w / h
        if abs(current_ratio - target_ratio) < 0.01:
            return b64_str
        if current_ratio > target_ratio:
            new_w = int(h * target_ratio)
            left = (w - new_w) // 2
            cropped = img[:, left : left + new_w]
        else:
            new_h = int(w / target_ratio)
            top = (h - new_h) // 2
            cropped = img[top : top + new_h, :]
        _, buf = cv2.imencode(".jpg", cropped)
        return base64.b64encode(buf.tobytes()).decode()
    except Exception:
        return b64_str


# --- Gemini Classifier Node ---

ANALYSIS_PROMPT = """You are an expert automotive photography analyst. Analyze this image and extract structured metadata.

Return ONLY valid JSON matching this exact schema (no markdown, no extra text):
{
  "view_category": "interior" | "exterior" | "detail",
  "components": ["list", "of", "detected", "components"],
  "existing_lighting": "natural" | "studio" | "mixed" | "dim" | "harsh" | "soft" | "unknown",
  "dominant_color": "string color name",
  "suggested_edit_mode": "product-image" | "inpainting-insert" | "outpainting"
}

Rules:
- view_category: "interior" = cabin/dashboard/seats, "exterior" = full car shot, "detail" = close-up of part (wheel, hood, etc.)
- components: List ALL visible parts. For wheel/rim shots include: rims, tire, fender, wheel arch, mudguard, body panel if visible. For interior: leather, screens, dashboard, steering wheel, headlights. For exterior: hood, headlights, bumper, body panels.
- suggested_edit_mode: "product-image" for exterior/car shots (background swap), "inpainting-insert" for adding elements, "outpainting" for extending
"""


def _get_genai_client() -> genai.Client:
    """Create Gen AI client. Prefer Vertex; use Google AI Studio only when GEMINI_PROVIDER=google_ai."""
    provider = os.getenv("GEMINI_PROVIDER", "vertex").lower()
    api_key = os.getenv("GOOGLE_AI_API_KEY", "").strip()
    if provider == "google_ai" and api_key:
        return genai.Client(vertexai=False, api_key=api_key)
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT_ID", "")
    location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
    return genai.Client(
        vertexai=True,
        project=project_id,
        location=location,
    )


def _detect_image_mime(image_bytes: bytes) -> str:
    """Detect MIME type from image magic bytes. Returns image/jpeg, image/png, or image/webp."""
    if len(image_bytes) >= 8 and image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"  # default, also matches \xff\xd8\xff


def _ensure_openai_compatible_image(image_bytes: bytes) -> tuple[bytes, str]:
    """
    Convert image to OpenAI-supported format (JPEG). Handles HEIC, BMP, TIFF, etc.
    Returns (jpeg_bytes, "image/jpeg").
    """
    try:
        try:
            from pillow_heif import register_heif_opener

            register_heif_opener()
        except ImportError:
            pass
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        elif img.mode != "RGB":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        # Fallback: try cv2 for common formats
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])
            return buf.tobytes(), "image/jpeg"
        raise


def _get_image_b64_for_classifier(img: dict) -> str:
    """Get base64 for classifier. Fetches from image_url if bytes_b64 empty (GCS optimization)."""
    b64 = img.get("bytes_b64", "")
    if b64:
        return b64
    url = img.get("image_url", "")
    if not url:
        raise ValueError("Image has no bytes_b64 or image_url")
    import urllib.request
    with urllib.request.urlopen(url, timeout=30) as r:
        data = r.read()
    return base64.b64encode(data).decode("ascii")


def _classify_image_url_openai(image_url: str, index: int) -> AutomotiveImageMetadata:
    """Classify one image with OpenAI using URL directly (no fetch)."""
    from openai import OpenAI

    # Cache by URL string. This keeps outputs identical for the same input.
    try:
        from app.cache import cache_get_json, cache_set_json, sha256_text

        cache_key = f"meta_url:{sha256_text(image_url)}"
        cached = cache_get_json(cache_key)
        if isinstance(cached, dict):
            return _normalize_metadata(cached)
    except Exception:
        cache_key = None

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set. Required when METADATA_PROVIDER=openai")
    client = OpenAI(api_key=api_key)
    model = os.getenv("OPENAI_METADATA_MODEL", "gpt-4o-mini")
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert automotive photography analyst. Return ONLY valid JSON, no markdown."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": ANALYSIS_PROMPT},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ],
        max_tokens=1024,
        temperature=0.1,
    )
    text = (response.choices[0].message.content or "").strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    data = json.loads(text)
    if cache_key:
        try:
            cache_set_json(cache_key, data)
        except Exception:
            pass
    return _normalize_metadata(data)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _classify_single_image_openai(image_b64: str, index: int) -> AutomotiveImageMetadata:
    """Classify one image with OpenAI GPT-4o mini Vision."""
    from openai import OpenAI

    # Cache by exact base64 bytes (after stripping data URI).
    try:
        from app.cache import cache_get_json, cache_set_json, sha256_b64

        cache_key = f"meta_b64:{sha256_b64(image_b64)}"
        cached = cache_get_json(cache_key)
        if isinstance(cached, dict):
            return _normalize_metadata(cached)
    except Exception:
        cache_key = None

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set. Required when METADATA_PROVIDER=openai")
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    image_data = base64.b64decode(image_b64)
    # Convert HEIC/BMP/TIFF etc. to JPEG - OpenAI only accepts png, jpeg, gif, webp
    try:
        jpeg_bytes, mime = _ensure_openai_compatible_image(image_data)
        image_b64 = base64.b64encode(jpeg_bytes).decode()
    except Exception as conv_err:
        logger.warning("Image conversion failed, using original: %s", conv_err)
        mime = _detect_image_mime(image_data)
    client = OpenAI(api_key=api_key)
    model = os.getenv("OPENAI_METADATA_MODEL", "gpt-4o-mini")
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert automotive photography analyst. Return ONLY valid JSON, no markdown."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": ANALYSIS_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                ],
            },
        ],
        max_tokens=1024,
        temperature=0.1,
    )
    text = (response.choices[0].message.content or "").strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    data = json.loads(text)
    if cache_key:
        try:
            cache_set_json(cache_key, data)
        except Exception:
            pass
    return _normalize_metadata(data)


def _get_vertex_client() -> genai.Client:
    """Create Vertex AI client for Imagen. edit_image requires Vertex, not Google AI Studio."""
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT_ID", "")
    location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
    if not project_id:
        raise ValueError(
            "V8/Vertex Imagen requires GOOGLE_CLOUD_PROJECT_ID. Set it in .env (GCP project ID)."
        )
    return genai.Client(vertexai=True, project=project_id, location=location)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _classify_single_image(client: genai.Client, image_b64: str, index: int) -> AutomotiveImageMetadata:
    """Classify one image with Gemini Vision."""
    # Strip data URL prefix if present
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    image_data = base64.b64decode(image_b64)
    img_part = types.Part.from_bytes(data=image_data, mime_type="image/jpeg")
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")
    response = client.models.generate_content(
        model=model,
        contents=[ANALYSIS_PROMPT, img_part],
        config=types.GenerateContentConfig(
            temperature=0.1,
            top_p=0.95,
            max_output_tokens=1024,
        ),
    )
    text = (response.text or "").strip()
    # Extract JSON (handle markdown code blocks)
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    data = json.loads(text)
    return _normalize_metadata(data)


def _normalize_metadata(data: dict) -> AutomotiveImageMetadata:
    """Ensure view_category and suggested_edit_mode match schema (handles 'unknown' etc)."""
    view = (data.get("view_category") or "").lower()
    if view not in ("interior", "exterior", "detail"):
        data["view_category"] = "exterior"
    mode = (data.get("suggested_edit_mode") or "").lower().replace(" ", "-")
    if mode not in ("product-image", "inpainting-insert", "outpainting"):
        data["suggested_edit_mode"] = "product-image"
    return AutomotiveImageMetadata(**data)


def gemini_classifier_node(state: GraphState) -> dict:
    """Analyze each image with Vision AI; output strict AutomotiveImageMetadata."""
    pipeline_version = state.get("pipeline_version", "1")
    provider = os.getenv("METADATA_PROVIDER", os.getenv("GEMINI_PROVIDER", "vertex")).lower()
    use_openai = provider == "openai" or pipeline_version == "11"
    client = _get_genai_client() if not use_openai else None
    images: list[ImageItem] = state.get("images", [])
    target = state.get("target_studio_description", "")
    logs: list[str] = []
    metadata_tuples: list[tuple[int, AutomotiveImageMetadata]] = []

    for img in images:
        idx = img["index"]
        logs.append(f"Analyzing image {idx + 1}...")
        try:
            if use_openai:
                if img.get("image_url") and not img.get("bytes_b64"):
                    meta = _classify_image_url_openai(img["image_url"], idx)
                else:
                    b64 = _get_image_b64_for_classifier(img)
                    meta = _classify_single_image_openai(b64, idx)
            else:
                b64 = _get_image_b64_for_classifier(img)
                meta = _classify_single_image(client, b64, idx)
            metadata_tuples.append((idx, meta))
            comps = (meta.components or [])[:3]
            logs.append(f"  → {meta.view_category}, {comps}...")
        except (ValidationError, json.JSONDecodeError, Exception) as e:
            err_msg = str(e)
            if hasattr(e, "last_attempt"):
                try:
                    inner = e.last_attempt.exception() if hasattr(e.last_attempt, "exception") else None
                    if inner is not None:
                        err_msg = str(inner)
                except Exception:
                    pass
            logger.warning("Metadata classification failed for image %s: %s", idx + 1, err_msg)
            logs.append(f"  → Fallback metadata (error: {sanitize_error(err_msg)})")
            metadata_tuples.append(
                (
                    idx,
                    AutomotiveImageMetadata(
                        view_category="exterior",
                        components=[],
                        existing_lighting="unknown",
                        dominant_color="unknown",
                        suggested_edit_mode="product-image",
                    ),
                )
            )

    return {
        "metadata": metadata_tuples,
        "logs": logs,
    }


# --- Dynamic Prompt Node ---

def _build_guidance_and_steps(meta: AutomotiveImageMetadata, pipeline_version: str = "1") -> tuple[int, int]:
    """Dynamic guidance_scale and base_steps from metadata."""
    if meta.view_category == "interior":
        return 55, 50
    if meta.view_category == "exterior":
        return 25, 35
    # detail: V2 uses lower guidance to reduce over-editing (inner fender)
    if pipeline_version == "2":
        return 30, 38
    # V4: same as V1 for detail
    return 40, 45


def dynamic_prompt_node(state: GraphState) -> dict:
    """Build Vertex AI payloads with dynamic guidance_scale and edit strengths."""
    images: list[ImageItem] = state.get("images", [])
    metadata_tuples: list[tuple[int, AutomotiveImageMetadata]] = state.get("metadata", [])
    target = state.get("target_studio_description", "")
    pipeline_version = state.get("pipeline_version", "1")
    meta_by_idx = {idx: m for idx, m in metadata_tuples}

    payloads: list[VertexPayload] = []
    logs: list[str] = []

    target_short = target[:200] + "..." if len(target) > 200 else target
    preview = bool(state.get("preview", False))
    dealer_branding = state.get("dealer_branding")
    dealer_logo_b64 = None
    branding_instructions = []
    if dealer_branding and dealer_branding.get("logo_b64"):
        dealer_logo_b64 = dealer_branding["logo_b64"]
        if dealer_branding.get("logo_3d_wall_enabled"):
            branding_instructions.append("Place the dealer logo from the third reference image on the studio backdrop wall behind the car in realistic 3D perspective as a physical sign. Do NOT place it on the car or windows.")
        if dealer_branding.get("license_plate_enabled"):
            branding_instructions.append("Clean the license plate area and place the dealer logo from the third reference image on it, sized to fit the plate.")
    branding_instruction = " " + " ".join(branding_instructions) if branding_instructions else ""

    # V2: refined preservation rules (inner fender, softer shadows)
    preserve_rules_v1 = (
        "CRITICAL: Preserve exactly - if headlights/lights are ON in the original, keep them ON. "
        "Keep the number plate and any text on it unchanged. Enhance logos but do not alter them. "
        "Keep the exact same angle, framing, and size - never extend or change dimensions. "
        "Do not hallucinate, add, or remove objects. Do not lose context or drift."
    )
    preserve_rules_v2 = (
        "CRITICAL: Preserve exactly - lights, number plate, logos, angle, framing, size. "
        "Do not hallucinate or remove objects. All edits must look natural and photographically plausible. "
        "Shadows and reflections must match the studio lighting - no artificial or excessive reflections."
    )
    # V4: feedback-tuned - no hallucinations, strict color preservation, reflection removal, natural studio
    preserve_rules_v4 = (
        "CRITICAL: The car MUST remain EXACTLY as in the original. Do NOT change the car model, bumper, fog lights, or any visible features. "
        "Preserve angle, framing, size, and wheel design (spoke pattern, two-tone or solid). Preserve lights (on=on, off=off) and license plates exactly. "
        "Remove reflections on hood and glossy surfaces. Output must be photorealistic."
    )

    for img in images:
        idx = img["index"]
        meta = meta_by_idx.get(idx)
        if not meta:
            continue
        guidance, steps = _build_guidance_and_steps(meta, pipeline_version)
        edit_mode = meta.suggested_edit_mode
        mask_mode = "background" if edit_mode == "product-image" else "foreground"
        if pipeline_version == "2":
            preserve_rules = preserve_rules_v2
        elif pipeline_version in ("4", "6", "7", "8", "10", "11"):
            preserve_rules = preserve_rules_v4
        else:
            preserve_rules = preserve_rules_v1

        if pipeline_version == "11":
            # V11: OpenAI GPT Image 1.5 - multi-image (car, studio, optional logo). Washed car, 3D logo, license plate.
            color_hint = getattr(meta, "dominant_color", None) or ""
            v11_color = f"USED CAR: {color_hint}. Copy EXACT color - same shade, brightness, saturation. Washed clean but SAME color." if (color_hint and color_hint.lower() != "unknown") else "USED CAR: Copy EXACT color from original. Same shade, brightness, saturation. Washed clean but SAME color."
            if meta.view_category == "interior":
                prompt = (
                    f"Replace everything visible through the windshield and all car windows with the studio backdrop from the second reference image: {target_short}. "
                    f"Remove outdoor view, garage, vehicles, sky. Remove reflections on glossy interior. "
                    f"Keep the car interior unchanged - dashboard, seats, steering wheel, all colors and materials. "
                    f"CRITICAL: Preserve the EXACT camera angle, framing, and crop. Do NOT zoom out or show more of the cabin/windows than the original. "
                    f"CRITICAL: Output must stay 4:3 (do not change aspect ratio). "
                    f"CRITICAL: Do NOT hallucinate any new interior parts (extra windows, steering wheel parts, screens, trims). "
                    f"The studio must look photographically realistic. "
                    f"{preserve_rules}"
                )
            elif meta.view_category == "exterior":
                prompt = (
                    f"Replace the background of the first image (the car) with the studio environment from the second reference image: {target_short}. "
                    f"CRITICAL: {v11_color} No vibrant/glossy/new-car look. Minimal lighting change - like original with background swapped. "
                    f"CRITICAL: Keep the car EXACTLY as it is - same model, bumper, fog lights, every detail. Same view (rear=rear, front=front), same angle, no flip. "
                    f"CRITICAL: Preserve headlights, taillights, DRLs exactly - if on, keep on; if off, keep off. "
                    f"CRITICAL: Preserve wheel design, badges, logos, license plate area. "
                    f"The studio must be empty - no people, no person shadows. Remove reflections on hood and body. "
                    f"Add subtle natural floor shadows only from the car. Photorealistic result. "
                    f"{preserve_rules}"
                    f"{branding_instruction}"
                )
            else:
                comps_hint = ", ".join((meta.components or [])[:8]) if meta.components else "wheel, tire, rim, fender, mudguard, wheel arch, body"
                prompt = (
                    f"Replace ONLY the ground beneath the tire with the studio from the second reference image: {target_short}. "
                    f"CRITICAL: Do NOT isolate or cut out the wheel. Keep the FULL scene: fender, wheel arch, mudguard, body panel, wheel, tire, rim. "
                    f"CRITICAL: Preserve EXACT camera angle, framing, and crop. Do NOT zoom out, widen the view, or outpaint missing body parts. "
                    f"CRITICAL: Preserve exact color and brightness. "
                    f"Visible elements: {comps_hint}. Preserve all original colors. Remove reflections. Minimal floor shadows. "
                    f"{preserve_rules}"
                )
        elif pipeline_version in ("6", "7"):
            # V6/V7: Fal FLUX / Replicate Studio - same prompts, "studio from second reference" + target_short
            if meta.view_category == "interior":
                prompt = (
                    f"Replace everything visible through the windshield and all car windows with a clean, natural-looking studio backdrop from the second reference image: {target_short}. "
                    f"Remove the outdoor view, garage, vehicles, sky, and any scenery outside the car. "
                    f"Remove reflections on glossy interior surfaces (dashboard, center console, trim). "
                    f"Keep the car interior unchanged - dashboard, seats, steering wheel, center console, all colors and materials. "
                    f"The studio must look photographically realistic, not artificial. "
                    f"{preserve_rules}"
                )
            elif meta.view_category == "exterior":
                prompt = (
                    f"Replace the background with the studio from the second reference image: {target_short}. "
                    f"CRITICAL: Keep the car EXACTLY as it is - same model, same bumper, same fog lights, same every detail. "
                    f"CRITICAL: Preserve the EXACT car color and brightness - do NOT lighten, darken, or alter. The car must look identical in color and exposure to the original. Do not change luminosity or saturation. "
                    f"CRITICAL: Preserve headlights, taillights, DRLs and all lights exactly as in the original - if on, keep on; if off, keep off. "
                    f"CRITICAL: Preserve all car badges, logos, emblems, grille details - keep them clean, sharp, and enhanced. "
                    f"Enhance clarity and sharpness of the car while keeping all authentic details; remove only unwanted reflections. "
                    f"CRITICAL: Preserve the EXACT camera angle, framing, perspective, and composition from the original. "
                    f"The car must appear in the exact same position, size, and angle - do not rotate, zoom, or reposition. "
                    f"CRITICAL: Do NOT add any person shadows, photographer shadows, or human shadows on the car. "
                    f"The studio must be empty - no people, no person silhouettes, no person shadows on the vehicle. "
                    f"Remove all reflections on hood, engine cover, and body panels. "
                    f"The studio must look natural and photographically realistic - avoid smooth gradients that look AI-generated. "
                    f"Add subtle, natural floor shadows only from the car itself. "
                    f"The car's color and brightness must match the original exactly - no brightening or color shift. "
                    f"{preserve_rules}"
                    f"{branding_instruction}"
                )
            else:
                # Detail: wheel, rim - same as V4
                comps_hint = ", ".join((meta.components or [])[:8]) if meta.components else "wheel, tire, rim, fender, mudguard, wheel arch, body"
                prompt = (
                    f"Replace ONLY the ground beneath the tire with the studio from the second reference image: {target_short}. "
                    f"CRITICAL: Do NOT isolate or cut out the wheel. Keep the FULL scene: fender, wheel arch, mudguard, body panel, wheel, tire, rim - everything visible must stay. "
                    f"CRITICAL: Preserve the EXACT camera angle, framing, and composition - do not rotate or reposition. "
                    f"CRITICAL: Preserve exact color and brightness of wheel, tire, and body - do not lighten or darken. "
                    f"CRITICAL: Do NOT add any person shadows or human shadows on the car or wheel. "
                    f"Visible elements to preserve: {comps_hint}. Keep badges, logos, and rim details clean and enhanced. "
                    f"Preserve all original colors. Remove reflections. Add minimal, realistic floor shadows only from the car. "
                    f"The studio floor must look natural. "
                    f"{preserve_rules}"
                )
        elif meta.view_category == "interior":
            if pipeline_version in ("4", "10"):
                prompt = (
                    f"Replace everything visible through the windshield and all car windows with a clean, natural-looking studio backdrop: {target_short}. "
                    f"Remove the outdoor view, garage, vehicles, sky, and any scenery outside the car. "
                    f"Remove reflections on glossy interior surfaces (dashboard, center console, trim). "
                    f"Keep the car interior unchanged - dashboard, seats, steering wheel, center console, all colors and materials. "
                    f"CRITICAL: Do NOT extend or shorten - preserve the exact angle, size, and proportion. No cropping, stretching, or resizing. "
                    f"CRITICAL: Do NOT change the perspective - preserve the exact camera perspective and viewing angle. "
                    f"The studio must look photographically realistic, not artificial. "
                    f"{preserve_rules}"
                )
            elif pipeline_version == "8":
                prompt = (
                    f"Replace everything visible through the windshield and all car windows with a clean, natural-looking studio backdrop: {target_short}. "
                    f"Remove the outdoor view, garage, vehicles, sky, and any scenery outside the car. "
                    f"Remove reflections on glossy interior surfaces (dashboard, center console, trim). "
                    f"Keep the car interior unchanged - dashboard, seats, steering wheel, center console, all colors and materials. "
                    f"The studio must look photographically realistic, not artificial. "
                    f"{preserve_rules}"
                )
            else:
                prompt = (
                    f"Replace everything visible through the windshield and all car windows with a clean studio backdrop: {target_short}. "
                    f"Remove the outdoor view, garage, vehicles, sky, and any scenery outside the car. "
                    f"Keep the car interior unchanged - dashboard, seats, steering wheel, center console, all colors and materials. "
                    f"{preserve_rules}"
                )
        elif meta.view_category == "exterior":
            if pipeline_version == "2":
                prompt = (
                    f"Replace the background with {target_short}. "
                    f"Keep the car exactly as it is. Preserve all original colors. "
                    f"Remove harsh reflections. Add only subtle, natural floor shadows where the car would cast them. "
                    f"{preserve_rules}"
                )
            elif pipeline_version == "4":
                prompt = (
                    f"Replace the background with {target_short}. "
                    f"CRITICAL: The output MUST show the SAME view of the car as the input. If the original shows the REAR (taillights, trunk), output MUST show the REAR. If the original shows the FRONT (headlights, grille), output MUST show the FRONT. "
                    f"CRITICAL: Preserve the EXACT viewing angle - do NOT flatten or straighten. If the original shows a side-rear three-quarter angle (some rear visible), output MUST show the same side-rear angle, NOT a pure side profile. If the original shows a pure side profile, keep it. Do NOT change the degree of rotation. "
                    f"CRITICAL: Do NOT reverse or flip the car's side. Front-right must stay front-right; front-left must stay front-left; same for rear-left/rear-right. "
                    f"CRITICAL: Preserve wheel design, color, and proportions exactly - same spoke pattern, same two-tone or solid finish. Do NOT elongate, stretch, or distort the car. "
                    f"CRITICAL: Preserve headlights, taillights, DRLs exactly as in the original - if ON, keep ON; if OFF, keep OFF. "
                    f"CRITICAL: If the original has a visible license plate or dealer plate, include the EXACT same text and content. Never remove or replace. "
                    f"CRITICAL: Keep the car EXACTLY as it is - same model, bumper, fog lights, every detail. Same size, proportion, and perspective. No cropping, stretching, or resizing. "
                    f"Preserve the EXACT car color. Do NOT add person shadows on the car. "
                    f"CRITICAL: Re-light the car to match the studio - remove outdoor highlights and shadows from the car body, apply soft even studio lighting. The car must look naturally integrated, NOT like a cutout on a background. "
                    f"CRITICAL: Add a clear, realistic ground shadow beneath the car so it looks grounded on the studio floor - the car must NOT appear floating. "
                    f"Remove outdoor reflections on hood and body panels; use studio-appropriate reflections. The result must be photorealistic. "
                    f"{preserve_rules}"
                )
            elif pipeline_version == "10":
                # V10: used car washed - EXACT original color, minimal lighting, NO AI look (condensed for Fal/API limits)
                color_hint = getattr(meta, "dominant_color", None) or ""
                if color_hint and color_hint.lower() != "unknown":
                    v10_color = f"USED CAR: {color_hint}. Copy EXACT color - same shade, brightness, saturation. Washed clean but SAME color. No vibrant/glossy/new."
                else:
                    v10_color = "USED CAR: Copy EXACT color from original. Same shade, brightness, saturation. Washed clean but SAME color. No vibrant/new."
                v10_light = "Minimal lighting change. No studio lighting on car. No bright highlights or dramatic shadows. Like original with background swapped. No AI look."
                prompt = (
                    f"Replace the background with {target_short}. {v10_color} {v10_light} "
                    f"Same view as input (rear=rear, front=front). Same angle - no flatten, no straighten. Same side (no flip). "
                    f"Preserve wheels, lights (on=on, off=off), license plates exactly. Same model, bumper, every detail. No person shadows. "
                    f"Car: same color and lighting as original. Background only: clean studio. Used car washed - NOT AI-generated. "
                    f"{preserve_rules}"
                )
            elif pipeline_version == "8":
                prompt = (
                    f"Replace the background with {target_short}. "
                    f"CRITICAL: Keep the car EXACTLY as it is - same model, same bumper, same fog lights, same every detail. "
                    f"Preserve the EXACT car color - do not lighten, darken, or alter it. "
                    f"CRITICAL: Preserve the EXACT camera angle, framing, perspective, and composition. "
                    f"The car must appear in the exact same position, size, and angle. "
                    f"CRITICAL: Do NOT add any person shadows, photographer shadows, or human shadows on the car. "
                    f"Remove all reflections on hood, engine cover, and body panels. "
                    f"The studio must look natural and photographically realistic - avoid smooth gradients that look AI-generated. "
                    f"Add subtle, natural floor shadows only from the car itself. "
                    f"{preserve_rules}"
                )
            else:
                prompt = (
                    f"Replace the background with {target_short}. "
                    f"Keep the car exactly as it is. Preserve all original colors. "
                    f"Remove existing reflections. Add shadows and reflections based on studio lighting. "
                    f"{preserve_rules}"
                )
        else:
            # Detail: wheel, rim, hood - V2 adds inner fender protection
            comps_hint = ", ".join((meta.components or [])[:8]) if meta.components else "wheel, tire, rim, fender, mudguard, wheel arch, body"
            if pipeline_version == "2":
                prompt = (
                    f"Replace ONLY the ground/floor surface visible beneath the tire with {target_short}. "
                    f"CRITICAL: The inner fender well (dark area inside wheel arch) must remain COMPLETELY UNCHANGED. Do not mask, cut, or replace it. "
                    f"Do NOT isolate or cut out the wheel. Keep the FULL scene: fender, wheel arch, mudguard, body panel, wheel, tire, rim - everything visible must stay. "
                    f"Visible elements to preserve: {comps_hint}. "
                    f"Preserve all original colors. Add only minimal, realistic floor shadows. "
                    f"{preserve_rules}"
                )
            elif pipeline_version in ("4", "10"):
                prompt = (
                    f"Replace ONLY the ground beneath the tire with {target_short}. "
                    f"CRITICAL: Do NOT isolate or cut out the wheel. Keep the FULL scene: fender, wheel arch, mudguard, body panel, wheel, tire, rim - everything visible must stay. "
                    f"CRITICAL: Every visible part (headlights, wheels, trim, etc.) must remain the SAME size, SAME part, SAME model - do not alter or scale. "
                    f"CRITICAL: Do NOT extend or shorten - preserve the exact angle, size, and proportion. No cropping, stretching, or resizing. "
                    f"CRITICAL: Do NOT change the perspective - preserve the exact camera perspective and viewing angle. "
                    f"Preserve the exact same angle. Enhance tire detail naturally. "
                    f"Visible elements to preserve: {comps_hint}. "
                    f"Preserve all original colors. Remove reflections. Add minimal, realistic floor shadows. "
                    f"The studio floor must look natural. "
                    f"{preserve_rules}"
                )
            elif pipeline_version == "8":
                prompt = (
                    f"Replace ONLY the ground beneath the tire with {target_short}. "
                    f"CRITICAL: Do NOT isolate or cut out the wheel. Keep the FULL scene: fender, wheel arch, mudguard, body panel, wheel, tire, rim - everything visible must stay. "
                    f"Preserve the exact same angle. Enhance tire detail naturally. "
                    f"Visible elements to preserve: {comps_hint}. "
                    f"Preserve all original colors. Remove reflections. Add minimal, realistic floor shadows. "
                    f"The studio floor must look natural. "
                    f"{preserve_rules}"
                )
            else:
                prompt = (
                    f"Replace ONLY the ground beneath the car with {target_short}. "
                    f"CRITICAL: Do NOT isolate or cut out the wheel. Keep the FULL scene: fender, wheel arch, mudguard, body panel, wheel, tire, rim - everything visible must stay. "
                    f"Visible elements to preserve: {comps_hint}. "
                    f"Preserve all original colors. Keep the exact same angle, framing, and size. "
                    f"Remove existing reflections. Add studio-appropriate shadows and reflections. "
                    f"{preserve_rules}"
                )
        base_b64 = img.get("bytes_b64", "")
        car_url = img.get("image_url", "")
        pl = {
            "index": idx,
            "base_image_b64": base_b64,
            "prompt": prompt,
            "edit_mode": edit_mode,
            "mask_mode": mask_mode,
            "guidance_scale": guidance,
            "base_steps": steps,
            "metadata": meta,
            "preview": preview,
        }
        if car_url:
            pl["car_image_url"] = car_url
        if dealer_logo_b64 and meta.view_category == "exterior":
            pl["dealer_logo_b64"] = dealer_logo_b64
        if pipeline_version == "11" and meta.view_category == "exterior":
            pl["negative_prompt"] = "vibrant, glossy, new car, oversaturated, color shift, studio lighting, bright highlights, polished, dramatic shadows, AI-generated, 3D render, over-processed"
        if pipeline_version == "10" and meta.view_category == "exterior":
            pl["negative_prompt"] = "vibrant, glossy, new car, oversaturated, color shift, studio lighting, bright highlights, polished, dramatic shadows, artificial reflections, AI-generated, 3D render, over-processed"
        payloads.append(pl)
        if pipeline_version == "6":
            logs.append(f"Enhancing {meta.view_category}...")
        elif pipeline_version == "7":
            logs.append(f"Enhancing {meta.view_category}...")
        elif pipeline_version == "8":
            logs.append(f"Enhancing {meta.view_category}...")
        else:
            logs.append(f"Enhancing {meta.view_category}...")

    return {"vertex_payloads": payloads, "logs": logs}


# --- Remove-BG Pipeline (V3 detail shots) ---

def _edit_image_remove_bg(
    payload: VertexPayload,
    studio_b64: str | None = None,
) -> tuple[int, str]:
    """Remove background and composite onto studio - for V3 detail shots."""
    import urllib.request

    import replicate
    from PIL import Image

    base_b64 = payload["base_image_b64"]
    if "," in base_b64:
        base_b64 = base_b64.split(",", 1)[1]
    img_bytes = base64.b64decode(base_b64)
    w, h = Image.open(io.BytesIO(img_bytes)).size

    data_uri = f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode()}"
    output = replicate.run(REMOVE_BG_MODEL, input={"image": data_uri})

    if output is None:
        raise ValueError("Replicate remove-bg returned None")
    item = output[0] if isinstance(output, (list, tuple)) else output
    if item is None:
        raise ValueError("Replicate remove-bg returned empty output")

    out_bytes = None
    if hasattr(item, "read"):
        out_bytes = item.read()
    if out_bytes is None and hasattr(item, "url"):
        url_val = getattr(item, "url", None)
        url = url_val() if callable(url_val) else url_val
        if url:
            with urllib.request.urlopen(url) as resp:
                out_bytes = resp.read()
    if out_bytes is None and isinstance(item, str):
        with urllib.request.urlopen(item) as resp:
            out_bytes = resp.read()
    if not out_bytes:
        raise ValueError("Replicate remove-bg produced no image data")

    subject = Image.open(io.BytesIO(out_bytes)).convert("RGBA")
    if studio_b64:
        studio_raw = studio_b64.split(",", 1)[1] if "," in studio_b64 else studio_b64
        bg_img = Image.open(io.BytesIO(base64.b64decode(studio_raw))).convert("RGB")
        bg_img = bg_img.resize((w, h), Image.Resampling.LANCZOS)
    else:
        bg_img = Image.new("RGB", (w, h), color=(230, 230, 230))

    bg_img = bg_img.convert("RGBA")
    subject_resized = subject.resize((w, h), Image.Resampling.LANCZOS)
    bg_img.paste(subject_resized, (0, 0), subject_resized)

    out_buf = io.BytesIO()
    bg_img.convert("RGB").save(out_buf, format="JPEG", quality=95)
    b64_out = base64.b64encode(out_buf.getvalue()).decode()
    return payload["index"], b64_out


# --- Fal.ai FLUX Single-Image Edit (V4/V10 - no studio reference) ---

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=15))
def _edit_image_fal_single(payload: VertexPayload) -> tuple[int, str]:
    """Edit image via Fal.ai FLUX with single image + prompt. Used for V4/V10 when IMAGE_EDIT_PROVIDER=fal."""
    import urllib.request

    from PIL import Image

    if not os.getenv("FAL_KEY"):
        raise ValueError("FAL_KEY not set. Get one at https://fal.ai/dashboard/keys")

    car_url = payload.get("car_image_url")
    if car_url:
        car_data_uri = car_url
    else:
        base_b64 = payload["base_image_b64"]
        if "," in base_b64:
            base_b64 = base_b64.split(",", 1)[1]
        car_data_uri = f"data:image/jpeg;base64,{base_b64}"

    image_size = "auto"
    meta = payload.get("metadata")
    view = getattr(meta, "view_category", None) if meta else None
    if view in ("exterior", "detail") and not car_url:
        try:
            base_b64 = payload.get("base_image_b64", "")
            if "," in base_b64:
                base_b64 = base_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(base_b64)
            w, h = Image.open(io.BytesIO(img_bytes)).size
            image_size = {"width": w, "height": h}
        except Exception:
            pass

    import fal_client

    prompt = payload["prompt"]
    # Fal API has no documented prompt limit; Vertex/Replicate use 2560. Only truncate if very long (e.g. 4000+) to avoid API errors.
    if len(prompt) > 4000:
        prompt = prompt[:3997] + "..."
        logger.warning("Prompt truncated to 4000 chars for Fal API")

    # V10 exterior: min guidance (1.5) = stick close to original; Fal API requires >= 1.5
    guidance = 1.5 if payload.get("negative_prompt") else 4.0

    args: dict = {
        "prompt": prompt,
        "image_urls": [car_data_uri],
        "guidance_scale": guidance,
        "num_inference_steps": 32,
        "output_format": "jpeg",
    }
    if image_size != "auto":
        args["image_size"] = image_size

    result = fal_client.subscribe(FAL_FLUX_EDIT_MODEL, arguments=args)

    if not result or "images" not in result or not result["images"]:
        raise ValueError("Fal.ai FLUX returned no images")

    img_info = result["images"][0]
    url = img_info.get("url") if isinstance(img_info, dict) else getattr(img_info, "url", None)
    if not url:
        raise ValueError("Fal.ai FLUX image has no URL")

    with urllib.request.urlopen(url) as resp:
        out_bytes = resp.read()
    b64_out = base64.b64encode(out_bytes).decode()
    return payload["index"], b64_out


# --- Fal.ai FLUX Execution (V6 Multi-Image Reference) ---

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=15))
def _edit_image_fal_flux(payload: VertexPayload, studio_b64: str) -> tuple[int, str]:
    """
    Edit image via Fal.ai FLUX with multi-image reference.
    Passes car image + studio reference so FLUX adopts lighting, reflections, shadows.
    V6: Preserves original car color and size for exterior/detail (per V4 behavior).
    """
    import urllib.request

    from PIL import Image

    if not os.getenv("FAL_KEY"):
        raise ValueError(
            "FAL_KEY not set. Get one at https://fal.ai/dashboard/keys"
        )

    car_url = payload.get("car_image_url")
    if car_url:
        car_data_uri = car_url
    else:
        base_b64 = payload["base_image_b64"]
        if "," in base_b64:
            base_b64 = base_b64.split(",", 1)[1]
        car_data_uri = f"data:image/jpeg;base64,{base_b64}"

    if studio_b64.startswith("data:"):
        studio_data_uri = studio_b64
    else:
        studio_raw = studio_b64.split(",", 1)[1] if "," in studio_b64 else studio_b64
        studio_data_uri = f"data:image/jpeg;base64,{studio_raw}"

    # Fal.ai flux-2-flex: image_urls[0]=base, image_urls[1]=studio, [2]=logo (optional for 3D wall)
    image_urls = [car_data_uri, studio_data_uri]
    logo_b64 = payload.get("dealer_logo_b64")
    if logo_b64:
        if logo_b64.startswith("data:"):
            logo_uri = logo_b64
        else:
            logo_raw = logo_b64.split(",", 1)[1] if "," in logo_b64 else logo_b64
            logo_uri = f"data:image/png;base64,{logo_raw}"
        image_urls.append(logo_uri)

    # Preserve original size for exterior and detail (V4 behavior)
    image_size = "auto"
    meta = payload.get("metadata")
    view = getattr(meta, "view_category", None) if meta else None
    if view in ("exterior", "detail") and not car_url:
        try:
            base_b64 = payload.get("base_image_b64", "")
            if "," in base_b64:
                base_b64 = base_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(base_b64)
            w, h = Image.open(io.BytesIO(img_bytes)).size
            image_size = {"width": w, "height": h}
        except Exception:
            pass

    import fal_client

    args: dict = {
        "prompt": payload["prompt"],
        "image_urls": image_urls,
        "guidance_scale": 4.0,
        "num_inference_steps": 32,
        "output_format": "jpeg",
    }
    if image_size != "auto":
        args["image_size"] = image_size

    result = fal_client.subscribe(
        FAL_FLUX_EDIT_MODEL,
        arguments=args,
    )

    if not result or "images" not in result or not result["images"]:
        raise ValueError("Fal.ai FLUX returned no images")

    img_info = result["images"][0]
    url = img_info.get("url") if isinstance(img_info, dict) else getattr(img_info, "url", None)
    if not url:
        raise ValueError("Fal.ai FLUX image has no URL")

    with urllib.request.urlopen(url) as resp:
        out_bytes = resp.read()
    b64_out = base64.b64encode(out_bytes).decode()
    return payload["index"], b64_out


# --- V11: OpenAI GPT Image 1.5 Multi-Image Edit ---

OPENAI_GPT_IMAGE_MODEL = os.getenv("OPENAI_GPT_IMAGE_MODEL", "gpt-image-1.5")


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=15))
def _edit_image_openai_gpt(payload: VertexPayload, studio_b64: str) -> tuple[int, str]:
    """
    Edit image via OpenAI GPT Image 1.5 with multi-image reference.
    V11: car + studio + optional logo. Washed car, 3D logo on wall, license plate placement.
    """
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("V11 requires OPENAI_API_KEY. Set it in .env")
    if not studio_b64:
        raise ValueError("V11 requires studio_reference_image or studio_reference_data_uri")

    base_b64 = payload["base_image_b64"]
    if "," in base_b64:
        base_b64 = base_b64.split(",", 1)[1]
    car_bytes = base64.b64decode(base_b64)
    try:
        car_bytes, _ = _ensure_openai_compatible_image(car_bytes)
    except Exception:
        pass

    studio_raw = studio_b64.split(",", 1)[1] if "," in studio_b64 else studio_b64
    studio_bytes = base64.b64decode(studio_raw)
    try:
        studio_bytes, _ = _ensure_openai_compatible_image(studio_bytes)
    except Exception:
        pass

    # Preview mode: downscale inputs before sending to the model to reduce cost.
    # This does not change full-quality results because preview is opt-in.
    if payload.get("preview"):
        try:
            from PIL import Image

            def _downscale_jpeg(img_bytes: bytes, max_dim: int = 1024, quality: int = 72) -> bytes:
                im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                w, h = im.size
                scale = min(1.0, max_dim / max(w, h))
                if scale < 1.0:
                    im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                im.save(buf, format="JPEG", quality=quality, optimize=True)
                return buf.getvalue()

            car_bytes = _downscale_jpeg(car_bytes)
            studio_bytes = _downscale_jpeg(studio_bytes)
        except Exception:
            pass

    images: list[tuple[bytes, str, str]] = [
        (car_bytes, "car.jpg", "image/jpeg"),
        (studio_bytes, "studio.jpg", "image/jpeg"),
    ]
    logo_b64 = payload.get("dealer_logo_b64")
    if logo_b64:
        logo_raw = logo_b64.split(",", 1)[1] if "," in logo_b64 else logo_b64
        logo_bytes = base64.b64decode(logo_raw)
        images.append((logo_bytes, "logo.png", "image/png"))

    prompt = payload["prompt"]
    if len(prompt) > 30000:
        prompt = prompt[:29997] + "..."

    client = OpenAI(api_key=api_key)
    model = OPENAI_GPT_IMAGE_MODEL

    # OpenAI requires explicit mimetype; BytesIO alone sends application/octet-stream
    image_parts = [(name, io.BytesIO(b), mime) for b, name, mime in images]

    response = client.images.edit(
        image=image_parts,
        prompt=prompt,
        model=model,
        input_fidelity="high",
        background="opaque",
        output_format="jpeg",
        size="auto",
        n=1,
    )

    if not response.data or not response.data[0]:
        raise ValueError("OpenAI GPT Image returned no images")
    img = response.data[0]
    b64_out = img.b64_json
    if not b64_out:
        raise ValueError("OpenAI GPT Image response has no b64_json")
    return payload["index"], b64_out


# --- V7: Replicate Studio (Flux 2 Pro Multi-Image Reference) ---

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=15))
def _edit_image_replicate_studio(payload: VertexPayload, studio_b64: str) -> tuple[int, str]:
    """
    Edit image via Replicate Flux 2 Pro with multi-image reference.
    Passes car image + studio reference so the model adopts lighting and reflections.
    V7: Replicate equivalent of V6 (Fal FLUX).
    """
    import urllib.request

    import replicate

    if not os.getenv("REPLICATE_API_TOKEN"):
        raise ValueError(
            "V7 requires REPLICATE_API_TOKEN. Set it in .env (get token at https://replicate.com/account/api-tokens)"
        )
    if not studio_b64:
        raise ValueError("V7 requires studio_reference_image or studio_reference_data_uri")

    car_url = payload.get("car_image_url")
    if car_url:
        car_uri = car_url
    else:
        car_bytes = _resize_for_flux_pro(payload["base_image_b64"])
        car_uri = f"data:image/jpeg;base64,{base64.b64encode(car_bytes).decode()}"

    studio_bytes = _resize_for_flux_pro(studio_b64)
    studio_uri = f"data:image/jpeg;base64,{base64.b64encode(studio_bytes).decode()}"
    input_images = [car_uri, studio_uri]
    logo_b64 = payload.get("dealer_logo_b64")
    if logo_b64:
        logo_raw = logo_b64.split(",", 1)[1] if "," in logo_b64 else logo_b64
        logo_bytes = _resize_for_flux_pro(logo_raw)
        logo_uri = f"data:image/jpeg;base64,{base64.b64encode(logo_bytes).decode()}"
        input_images.append(logo_uri)

    output = replicate.run(
        REPLICATE_STUDIO_MODEL,
        input={
            "prompt": payload["prompt"],
            "input_images": input_images,
            "aspect_ratio": "match_input_image",
            "safety_tolerance": 5,
        },
    )

    if output is None:
        raise ValueError("Replicate Flux 2 Pro returned None")
    item = output[0] if isinstance(output, (list, tuple)) else output
    if item is None:
        raise ValueError("Replicate Flux 2 Pro returned empty output")

    out_bytes = None
    if hasattr(item, "read"):
        out_bytes = item.read()
    if out_bytes is None and hasattr(item, "url"):
        url_val = getattr(item, "url", None)
        url = url_val() if callable(url_val) else url_val
        if url:
            with urllib.request.urlopen(url) as resp:
                out_bytes = resp.read()
    if out_bytes is None and isinstance(item, str):
        with urllib.request.urlopen(item) as resp:
            out_bytes = resp.read()
    if not out_bytes:
        raise ValueError("Replicate Flux 2 Pro produced no image data")

    b64_out = base64.b64encode(out_bytes).decode()
    return payload["index"], b64_out


# --- Replicate Execution (Reve Edit) ---

def _edit_image_replicate(payload: VertexPayload) -> tuple[int, str]:
    """Edit image via Replicate (Reve Edit Fast) - no Vertex quota required."""
    import urllib.request

    import replicate

    if not os.getenv("REPLICATE_API_TOKEN"):
        raise ValueError(
            "REPLICATE_API_TOKEN not set. Get one at https://replicate.com/account/api-tokens"
        )

    base_b64 = payload["base_image_b64"]
    if "," in base_b64:
        base_b64 = base_b64.split(",", 1)[1]
    img_bytes = base64.b64decode(base_b64)

    # Reve/Imagen edit_instruction limit: 2560 chars (Replicate uses Vertex under hood)
    prompt = payload["prompt"]
    if len(prompt) > 2560:
        prompt = prompt[:2557] + "..."
        logger.warning("Prompt truncated to 2560 chars for edit API limit")

    # Replicate expects a file path or file-like; use temp file for compatibility
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(img_bytes)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as f:
            output = replicate.run(
                REPLICATE_EDIT_MODEL,
                input={
                    "image": f,
                    "prompt": prompt,
                },
            )
    finally:
        os.unlink(tmp_path)
    # Handle FileOutput, URL string, or list of outputs
    item = output[0] if isinstance(output, (list, tuple)) else output
    if hasattr(item, "read"):
        out_bytes = item.read()
    elif hasattr(item, "url"):
        with urllib.request.urlopen(item.url) as resp:
            out_bytes = resp.read()
    elif isinstance(item, str):
        with urllib.request.urlopen(item) as resp:
            out_bytes = resp.read()
    else:
        raise ValueError(f"Unexpected Replicate output type: {type(output)}")
    b64_out = base64.b64encode(out_bytes).decode()
    return payload["index"], b64_out


# --- Vertex AI Execution Node (Async) ---

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=15))
def _edit_image_vertex(payload: VertexPayload) -> tuple[int, str]:
    """Sync Vertex Imagen edit via Google Gen AI SDK (imagen-3.0-capability-001)."""
    client = _get_vertex_client()
    # edit_image API requires imagen-3.0-capability-001; generate-002 causes "No uri or raw bytes" error
    model_id = os.getenv("VERTEX_IMAGEN_MODEL", "imagen-3.0-capability-001")
    if "generate" in model_id:
        model_id = "imagen-3.0-capability-001"
        logger.warning("edit_image requires imagen-3.0-capability-001; overriding VERTEX_IMAGEN_MODEL")

    base_b64 = payload["base_image_b64"]
    if "," in base_b64:
        base_b64 = base_b64.split(",", 1)[1]
    img_bytes = base64.b64decode(base_b64)
    mask_mode = (
        "MASK_MODE_BACKGROUND"
        if payload.get("mask_mode") == "background"
        else "MASK_MODE_FOREGROUND"
    )

    reference_images = [
        types.RawReferenceImage(
            reference_id=1,
            reference_image=types.Image(image_bytes=img_bytes, mime_type="image/jpeg"),
        ),
        types.MaskReferenceImage(
            reference_id=2,
            config=types.MaskReferenceConfig(
                mask_mode=mask_mode,
                mask_dilation=0.0,
            ),
        ),
    ]

    # Vertex edit_instruction limit: 2560 chars
    prompt = payload["prompt"]
    if len(prompt) > 2560:
        prompt = prompt[:2557] + "..."
        logger.warning("Prompt truncated to 2560 chars for Vertex API limit")

    config_kw: dict = {
        "edit_mode": types.EditMode.EDIT_MODE_PRODUCT_IMAGE,
        "number_of_images": 1,
        "guidance_scale": payload["guidance_scale"],
        "base_steps": payload.get("base_steps"),
    }
    neg = payload.get("negative_prompt")
    if neg:
        config_kw["negative_prompt"] = neg
    response = client.models.edit_image(
        model=model_id,
        prompt=prompt,
        reference_images=reference_images,
        config=types.EditImageConfig(**config_kw),
    )

    if not response.generated_images:
        raise ValueError("No images in response")
    img = response.generated_images[0].image
    if not img or not img.image_bytes:
        raise ValueError("No image bytes in response")
    b64_out = base64.b64encode(img.image_bytes).decode()
    return payload["index"], b64_out


def _format_edit_error(exc: BaseException) -> str:
    """Extract a clear error message from edit exceptions (including RetryError, FalClientHTTPError, ModelError)."""
    from tenacity import RetryError

    if exc is None:
        return "Unknown error"

    if isinstance(exc, RetryError) and hasattr(exc, "last_attempt"):
        inner = exc.last_attempt.exception()
        if inner is not None:
            return _format_edit_error(inner)
        return str(exc) or "RetryError (no inner exception)"

    # Replicate ModelError: prediction.error can be None; use prediction.logs as fallback
    try:
        from replicate.exceptions import ModelError as ReplicateModelError
        if isinstance(exc, ReplicateModelError) and hasattr(exc, "prediction"):
            pred = exc.prediction
            err = getattr(pred, "error", None) if pred else None
            logs = getattr(pred, "logs", None) if pred else None
            if err and str(err).strip():
                return sanitize_error(str(err).strip())
            if logs and str(logs).strip():
                # Last line of logs often has the error
                lines = str(logs).strip().split("\n")
                last = lines[-1].strip() if lines else ""
                if last and len(last) < 500:
                    return sanitize_error(last)
                return sanitize_error(last[:200] + "...")
            return "Processing failed"
    except ImportError:
        pass

    # FalClientHTTPError: has .message with the API error detail
    msg = str(exc).strip() if exc else ""
    if hasattr(exc, "message") and exc.message:
        msg = str(exc.message)
    elif hasattr(exc, "response") and exc.response:
        try:
            body = exc.response.json() if hasattr(exc.response, "json") else {}
            detail = body.get("detail") or body.get("message") or body.get("error")
            if detail:
                msg = str(detail) if not isinstance(detail, dict) else detail.get("message", str(detail))
        except Exception:
            pass
    if not msg or msg == "None":
        msg = f"{type(exc).__name__}: {exc!r}"
    return sanitize_error(msg)


async def vertex_execution_node_async(
    state: GraphState,
    get_token: callable,
) -> dict:
    """Execute API calls. V1-V4: Reve/Vertex. V3: hybrid remove_bg. V6: Fal FLUX. V7: Replicate Studio. V8: Vertex Safe Queue."""
    payloads: list[VertexPayload] = state.get("vertex_payloads", [])
    images: list[ImageItem] = state.get("images", [])
    img_by_idx = {img["index"]: img for img in images}
    studio_b64 = state.get("studio_reference_b64")
    pipeline_version = state.get("pipeline_version", "1")
    semaphore = asyncio.Semaphore(5)
    results: list[dict] = []
    logs: list[str] = []
    loop = asyncio.get_event_loop()

    # V6: Fal.ai only - never use Vertex or Replicate
    if pipeline_version == "6":
        if not os.getenv("FAL_KEY"):
            raise ValueError("V6 requires FAL_KEY. Set it in .env (get key at https://fal.ai/dashboard/keys)")
        if not studio_b64:
            raise ValueError("V6 requires a studio reference image (upload or select preset)")

    # V11: OpenAI-only - metadata + GPT Image 1.5
    if pipeline_version == "11":
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("V11 requires OPENAI_API_KEY. Set it in .env")
        if not studio_b64:
            raise ValueError("V11 requires a studio reference image (upload or select preset)")

    # V7: Replicate Studio - requires studio reference
    if pipeline_version == "7":
        if not os.getenv("REPLICATE_API_TOKEN"):
            raise ValueError("V7 requires REPLICATE_API_TOKEN. Set it in .env")
        if not studio_b64:
            raise ValueError("V7 requires a studio reference image (upload or select preset)")

    # V8: Vertex Safe Queue - requires Vertex/GCP
    if pipeline_version == "8":
        if not os.getenv("GOOGLE_CLOUD_PROJECT_ID"):
            raise ValueError("V8 requires GOOGLE_CLOUD_PROJECT_ID for Vertex Imagen")

    provider = (state.get("model_override") or os.getenv("IMAGE_EDIT_PROVIDER", "replicate")).lower()

    def _get_model_info(p: VertexPayload) -> dict:
        """Return provider and model id for display and regenerate."""
        if pipeline_version == "6":
            return {"provider": "fal", "model": FAL_FLUX_EDIT_MODEL}
        if pipeline_version == "11":
            return {"provider": "openai", "model": OPENAI_GPT_IMAGE_MODEL}
        if pipeline_version == "7":
            return {"provider": "replicate", "model": REPLICATE_STUDIO_MODEL}
        if pipeline_version == "8":
            model_id = os.getenv("VERTEX_IMAGEN_MODEL", "imagen-3.0-capability-001")
            if "generate" in model_id:
                model_id = "imagen-3.0-capability-001"
            return {"provider": "vertex", "model": model_id}
        if pipeline_version in ("4", "10"):
            if provider == "fal":
                return {"provider": "fal", "model": FAL_FLUX_EDIT_MODEL}
            if provider == "vertex":
                model_id = os.getenv("VERTEX_IMAGEN_MODEL", "imagen-3.0-capability-001")
                if "generate" in model_id:
                    model_id = "imagen-3.0-capability-001"
                return {"provider": "vertex", "model": model_id}
            return {"provider": "replicate", "model": REPLICATE_EDIT_MODEL}
        if pipeline_version == "3":
            meta = p.get("metadata")
            view = getattr(meta, "view_category", None) if meta else None
            if view == "detail":
                return {"provider": "replicate", "model": REMOVE_BG_MODEL.split(":")[0]}
            if provider == "fal":
                return {"provider": "fal", "model": FAL_FLUX_EDIT_MODEL}
            if provider == "vertex":
                model_id = os.getenv("VERTEX_IMAGEN_MODEL", "imagen-3.0-capability-001")
                if "generate" in model_id:
                    model_id = "imagen-3.0-capability-001"
                return {"provider": "vertex", "model": model_id}
            return {"provider": "replicate", "model": REPLICATE_EDIT_MODEL}
        # V1, V2
        if provider == "fal":
            return {"provider": "fal", "model": FAL_FLUX_EDIT_MODEL}
        if provider == "vertex":
            model_id = os.getenv("VERTEX_IMAGEN_MODEL", "imagen-3.0-capability-001")
            if "generate" in model_id:
                model_id = "imagen-3.0-capability-001"
            return {"provider": "vertex", "model": model_id}
        return {"provider": "replicate", "model": REPLICATE_EDIT_MODEL}

    def _get_edit_fn(p: VertexPayload):
        # V6: Fal.ai FLUX only
        if pipeline_version == "6":
            return lambda pl: _edit_image_fal_flux(pl, studio_b64)
        # V11: OpenAI GPT Image 1.5 multi-image
        if pipeline_version == "11":
            return lambda pl: _edit_image_openai_gpt(pl, studio_b64)
        # V7: Replicate Studio (Flux 2 Pro multi-image)
        if pipeline_version == "7":
            return lambda pl: _edit_image_replicate_studio(pl, studio_b64)
        # V8: Vertex only - uses dedicated safe-queue runner below
        if pipeline_version == "8":
            return _edit_image_vertex
        # V4/V10: fal | replicate | vertex
        if provider == "fal":
            return _edit_image_fal_single
        if provider == "vertex":
            return _edit_image_vertex
        # V3: hybrid - remove_bg for detail, Reve for exterior/interior
        if pipeline_version == "3":
            meta = p.get("metadata")
            view = getattr(meta, "view_category", None) if meta else None
            if view == "detail":
                return lambda pl: _edit_image_remove_bg(pl, studio_b64)
        # V1, V2, V4, V10: Reve for all (V10 adds color preservation in prompt + negative_prompt for Vertex)
        return _edit_image_replicate

    logs.append(f"Processing...")

    async def _run_v8_safe_queue(p: VertexPayload):
        """V8: Strict serialization + 3.5s throttle to stay under Vertex 429 (~15 RPM)."""
        async with VERTEX_V8_LOCK:
            result = await loop.run_in_executor(None, _edit_image_vertex, p)
            await asyncio.sleep(3.5)
        return result

    async def _run_with_semaphore(p: VertexPayload):
        edit_fn = _get_edit_fn(p)
        async with semaphore:
            return await loop.run_in_executor(None, edit_fn, p)

    if pipeline_version == "8":
        tasks = [_run_v8_safe_queue(p) for p in payloads]
    else:
        tasks = [_run_with_semaphore(p) for p in payloads]
    outcomes = await asyncio.gather(*tasks, return_exceptions=True)
    for i, out in enumerate(outcomes):
        if isinstance(out, Exception):
            err_msg = _format_edit_error(out)
            logger.exception("Image edit failed for image %s: %s", i + 1, err_msg)
            logs.append(f"Edit error for image {i + 1}: {err_msg}")
            p = payloads[i]
            model_info = _get_model_info(p)
            orig = p.get("base_image_b64") or p.get("car_image_url") or ""
            results.append(
                {
                    "index": p["index"],
                    "original_b64": orig,
                    "processed_b64": "",
                    "metadata": p["metadata"],
                    "error_message": err_msg,
                    "model_info": model_info,
                }
            )
        else:
            idx, processed_b64 = out
            p = payloads[i]
            img = img_by_idx.get(idx, {})
            orig_b64 = img.get("bytes_b64") or img.get("image_url") or ""
            meta = p.get("metadata") or next((pl["metadata"] for pl in payloads if pl["index"] == idx), None)
            if meta is None:
                meta = AutomotiveImageMetadata(
                    view_category="exterior",
                    components=[],
                    existing_lighting="unknown",
                    dominant_color="unknown",
                    suggested_edit_mode="product-image",
                )
            # Exterior + interior: enforce 4:3 aspect ratio
            if getattr(meta, "view_category", None) in ("exterior", "interior"):
                processed_b64 = _crop_to_aspect_ratio_4_3(processed_b64)
            model_info = _get_model_info(p)
            results.append(
                {
                    "index": idx,
                    "original_b64": orig_b64,
                    "processed_b64": processed_b64,
                    "metadata": meta,
                    "model_info": model_info,
                }
            )
            logs.append(f"Completed image {idx + 1}")

    return {"results": results, "logs": logs}
