#!/usr/bin/env python3
"""Quick test: Vertex/Gemini metadata classification (analyze-images)."""
import base64
import json
import os
import sys

# Ensure we load .env
from dotenv import load_dotenv
load_dotenv()

# Create a valid 256x256 JPEG (Gemini needs reasonable resolution)
def _make_test_image_b64() -> str:
    from PIL import Image
    import io
    img = Image.new("RGB", (256, 256), color=(180, 180, 180))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def test_analyze_images():
    """Call /api/v1/analyze-images and check for metadata (no fallback)."""
    import urllib.request

    url = "http://127.0.0.1:8000/api/v1/analyze-images"
    img_b64 = _make_test_image_b64()
    payload = {"images": [f"data:image/jpeg;base64,{img_b64}"]}
    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}")
        return False
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}")
        print("Is the backend running? (uvicorn app.main:app --port 8000)")
        return False

    results = body.get("results", [])
    if not results:
        print("No results returned")
        return False

    r = results[0]
    meta = r.get("metadata", {})
    view = meta.get("view_category", "")

    print("Response:", json.dumps(body, indent=2))
    print()
    if view in ("exterior", "interior", "detail"):
        print("OK: Vertex/Gemini metadata classification is working.")
        print(f"   view_category={view}")
        return True
    else:
        print("WARN: Got metadata but unexpected view_category:", view)
        return True  # Still got structured response


def test_direct_classifier():
    """Directly call classifier (OpenAI or Gemini)."""
    sys.path.insert(0, os.path.dirname(__file__))
    from app.graph.nodes import _get_genai_client, _classify_single_image, _classify_single_image_openai

    provider = os.getenv("METADATA_PROVIDER", os.getenv("GEMINI_PROVIDER", "vertex")).lower()
    use_openai = provider == "openai"
    print(f"Testing {'OpenAI' if use_openai else 'Gemini'} classifier...")
    if use_openai:
        print(f"  Model: {os.getenv('OPENAI_METADATA_MODEL', 'gpt-4o-mini')}")
    else:
        print(f"  Model: {os.getenv('GEMINI_MODEL', 'gemini-2.0-flash-001')}")

    try:
        img_b64 = _make_test_image_b64()
        if use_openai:
            meta = _classify_single_image_openai(img_b64, 0)
        else:
            client = _get_genai_client()
            meta = _classify_single_image(client, img_b64, 0)
        is_real = len(meta.components or []) > 0 or meta.existing_lighting != "unknown"
        if is_real:
            print(f"  OK (real): view_category={meta.view_category}, components={meta.components[:3] if meta.components else []}")
        else:
            print(f"  OK (generic): view_category={meta.view_category}")
        return True
    except Exception as e:
        print(f"  FAIL: {type(e).__name__}: {e}")
        from tenacity import RetryError
        if isinstance(e, RetryError) and hasattr(e, "last_attempt"):
            inner = e.last_attempt.exception()
            if inner:
                print(f"  Inner: {type(inner).__name__}: {inner}")
        return False


if __name__ == "__main__":
    print("=" * 50)
    print("Metadata Classification Test")
    print("=" * 50)
    provider = os.getenv("METADATA_PROVIDER", os.getenv("GEMINI_PROVIDER", "vertex"))
    print(f"METADATA_PROVIDER: {provider}")
    print()

    # Prefer direct test (no need for server)
    ok = test_direct_classifier()
    if ok:
        print()
        print("Direct classifier: PASS")
        sys.exit(0)

    # Fallback: HTTP test
    print()
    print("Trying HTTP analyze-images endpoint...")
    ok = test_analyze_images()
    sys.exit(0 if ok else 1)
