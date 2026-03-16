"""Analyze studio reference images with Vision AI (Gemini or OpenAI) to extract environment description."""

import base64
import json
import os

from google import genai
from google.genai import types

STUDIO_ANALYSIS_PROMPT = """You are an expert automotive photography studio analyst. Analyze this studio environment image and extract a detailed description for AI image generation.

Return ONLY valid JSON matching this exact schema (no markdown, no extra text):
{
  "environment_type": "string - e.g. cyclorama, infinity wall, high-key studio, dark studio",
  "background": "string - wall/backdrop color and texture",
  "floor": "string - floor color, material, any markings (circular platform, turntable, etc.)",
  "lighting": "string - soft/diffused/harsh, direction, shadow quality, high-key/low-key",
  "angle_perspective": "string - eye-level, low angle, overhead, etc.",
  "color_palette": "string - dominant colors, contrast",
  "key_features": ["list", "of", "notable", "features"],
  "generation_prompt": "string - A single comprehensive paragraph (2-4 sentences) describing this studio for use as an image generation prompt. Include: environment type, background, floor, lighting quality, perspective, and any distinctive elements. Write in a way that would allow an AI to recreate this exact studio look."
}
"""


def _detect_image_mime(image_bytes: bytes) -> str:
    """Detect MIME type from image magic bytes."""
    if len(image_bytes) >= 8 and image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


def _analyze_studio_openai(studio_b64: str) -> str:
    """Analyze studio image with OpenAI GPT-4o mini Vision."""
    import base64
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set. Required when METADATA_PROVIDER=openai")
    if "," in studio_b64:
        studio_b64 = studio_b64.split(",", 1)[1]
    studio_bytes = base64.b64decode(studio_b64)
    try:
        from app.graph.nodes import _ensure_openai_compatible_image

        studio_bytes, mime = _ensure_openai_compatible_image(studio_bytes)
        studio_b64 = base64.b64encode(studio_bytes).decode()
    except Exception:
        mime = _detect_image_mime(studio_bytes)
    client = OpenAI(api_key=api_key)
    model = os.getenv("OPENAI_METADATA_MODEL", "gpt-4o-mini")
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Return ONLY valid JSON, no markdown."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": STUDIO_ANALYSIS_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{studio_b64}"}},
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
    return data.get("generation_prompt", str(data))


def _get_genai_client() -> genai.Client:
    """Create Gen AI client. Prefer Vertex (separate quota from Imagen); use Google AI Studio only when GEMINI_PROVIDER=google_ai."""
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


DEFAULT_STUDIO_PROMPT = (
    "Professional automotive photography studio with neutral gray cyclorama background, "
    "soft diffused lighting, minimal shadows, clean floor. High-key studio look suitable for car product shots."
)


def analyze_studio_image(studio_b64: str, force_openai: bool = False) -> str:
    """
    Analyze a studio reference image with Vision AI (OpenAI or Gemini).
    Returns the generation_prompt field for use in image enhancement.
    Falls back to default when quota is exceeded (429).
    force_openai: when True (e.g. V11), always use OpenAI regardless of METADATA_PROVIDER.
    """
    provider = os.getenv("METADATA_PROVIDER", os.getenv("GEMINI_PROVIDER", "vertex")).lower()
    if provider == "openai" or force_openai:
        try:
            return _analyze_studio_openai(studio_b64)
        except Exception:
            return DEFAULT_STUDIO_PROMPT
    try:
        client = _get_genai_client()
        model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")

        if "," in studio_b64:
            studio_b64 = studio_b64.split(",", 1)[1]
        image_data = base64.b64decode(studio_b64)
        img_part = types.Part.from_bytes(data=image_data, mime_type="image/png")

        response = client.models.generate_content(
            model=model,
            contents=[STUDIO_ANALYSIS_PROMPT, img_part],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=1024,
            ),
        )
        text = (response.text or "").strip()

        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        data = json.loads(text)
        return data.get("generation_prompt", str(data))
    except Exception as e:
        err_str = str(e).lower()
        if "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str:
            return DEFAULT_STUDIO_PROMPT
        # 404 model not found: try Google AI Studio if key is set
        if "404" in err_str or "not_found" in err_str:
            api_key = os.getenv("GOOGLE_AI_API_KEY", "").strip()
            if api_key:
                try:
                    client = genai.Client(vertexai=False, api_key=api_key)
                    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")
                    b64 = studio_b64.split(",", 1)[1] if "," in studio_b64 else studio_b64
                    image_data = base64.b64decode(b64)
                    img_part = types.Part.from_bytes(data=image_data, mime_type="image/png")
                    response = client.models.generate_content(
                        model=model,
                        contents=[STUDIO_ANALYSIS_PROMPT, img_part],
                        config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=1024),
                    )
                    text = (response.text or "").strip()
                    if "```json" in text:
                        text = text.split("```json")[1].split("```")[0].strip()
                    elif "```" in text:
                        text = text.split("```")[1].split("```")[0].strip()
                    data = json.loads(text)
                    return data.get("generation_prompt", str(data))
                except Exception:
                    return DEFAULT_STUDIO_PROMPT
        raise
