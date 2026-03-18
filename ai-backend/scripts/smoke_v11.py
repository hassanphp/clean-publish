#!/usr/bin/env python3
"""
Smoke test for V11 pipeline (server end-to-end via HTTP):
- Logs in with the seeded admin user to obtain JWT
- Sends a single INTERIOR image with a studio reference
- Streams SSE from /api/v1/process-batch and captures the result
- Verifies the processed result is 4:3 (within small tolerance)

Run on EC2:
  cd ~/clean-publish/ai-backend
  source venv/bin/activate
  python scripts/smoke_v11.py
"""

import base64
import io
import json
import os
import sys
import time
import urllib.request
from urllib.error import HTTPError, URLError


def _read_file_b64_data_uri(path: str) -> str:
    try:
        try:
            from pillow_heif import register_heif_opener  # type: ignore

            register_heif_opener()
        except Exception:
            pass
        from PIL import Image  # type: ignore

        with Image.open(path) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=90)
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            return f"data:image/jpeg;base64,{b64}"
    except Exception:
        with open(path, "rb") as f:
            raw_bytes = f.read()

        # Best-effort: try OpenCV decode+re-encode to JPEG
        try:
            import numpy as np  # type: ignore
            import cv2  # type: ignore

            arr = np.frombuffer(raw_bytes, dtype=np.uint8)
            im = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
            if im is not None:
                if im.ndim == 2:
                    im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
                elif im.ndim == 3 and im.shape[2] == 4:
                    im = cv2.cvtColor(im, cv2.COLOR_BGRA2BGR)
                ok, enc = cv2.imencode(".jpg", im, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
                if ok and enc is not None:
                    b64 = base64.b64encode(enc.tobytes()).decode("ascii")
                    return f"data:image/jpeg;base64,{b64}"
        except Exception:
            pass

        b64 = base64.b64encode(raw_bytes).decode("ascii")
        ext = os.path.splitext(path)[1].lower().lstrip(".") or "jpeg"
        mime = "image/jpeg" if ext in ("jpg", "jpeg", "jfif") else (
            "image/png" if ext == "png" else "image/webp"
        )
        return f"data:{mime};base64,{b64}"

def _admin_judge_aspect_ratio(*, base: str, token: str, original_b64: str, processed_b64: str, metadata: dict, expected_view_category: str | None) -> dict:
    judge_url = base.rstrip("/") + "/api/v1/admin/judge"
    judge_req = {
        "pipeline_version": "11",
        "preview": True,
        "expected_aspect_ratio": "4:3",
        "use_llm_judge": False,
        "images": [
            {
                "index": 0,
                "original_b64": original_b64,
                "processed_b64": processed_b64,
                "metadata": metadata,
                "expected_view_category": expected_view_category,
            }
        ],
    }
    payload = json.dumps(judge_req).encode("utf-8")
    req = urllib.request.Request(
        judge_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def _aspect_ratio_from_processed_b64_data_uri(b64: str) -> tuple[float, int, int] | None:
    try:
        import numpy as np  # type: ignore
        import cv2  # type: ignore

        raw = b64.split(",", 1)[-1]
        img_bytes = base64.b64decode(raw)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        im = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
        if im is None:
            raise ValueError("cv2.imdecode returned None")
        h, w = im.shape[:2]
        ratio = w / h if h else 0.0
        return ratio, w, h
    except Exception:
        return None


def _sse_stream(req: urllib.request.Request):
    with urllib.request.urlopen(req, timeout=300) as resp:
        ctype = resp.headers.get("content-type", "")
        if "application/json" in ctype:
            # Async job mode not expected here, but handle gracefully
            data = json.loads(resp.read().decode("utf-8"))
            yield ("message", data)
            return
        # Stream lines
        buff = b""
        while True:
            chunk = resp.read(1024)
            if not chunk:
                break
            buff += chunk
            while b"\n" in buff:
                line, buff = buff.split(b"\n", 1)
                line = line.decode("utf-8", "ignore").strip()
                if not line:
                    continue
                if line.startswith("event:"):
                    current_event = line[6:].strip()
                elif line.startswith("data:"):
                    data_str = line[5:].strip()
                    try:
                        data = json.loads(data_str)
                    except Exception:
                        data = {"raw": data_str}
                    yield (current_event or "message", data)


def main():
    base = os.environ.get("SMOKE_API_BASE", "http://127.0.0.1:8000")
    login_url = base.rstrip("/") + "/api/v1/auth/login"
    process_url = base.rstrip("/") + "/api/v1/process-batch"

    # Resolve demo images from the monorepo
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_demo = os.path.abspath(os.path.join(repo_root, "..", "ai-frontend", "public", "demo"))
    interior_before = os.path.join(frontend_demo, "interior-before.avif")
    interior_after = os.path.join(frontend_demo, "interior-after.avif")
    if not os.path.exists(interior_before) or not os.path.exists(interior_after):
        print("Demo images not found:")
        print("  ", interior_before)
        print("  ", interior_after)
        sys.exit(2)

    # Login as seeded admin (ensure app.seed was run previously)
    login_payload = json.dumps({
        "email": "dealer@domain.com",
        "password": "Admin@321",
    }).encode("utf-8")
    try:
        req = urllib.request.Request(
            login_url,
            data=login_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            tok = json.loads(r.read().decode("utf-8")).get("access_token", "")
    except HTTPError as e:
        print("Login failed:", e.code, e.read().decode("utf-8", "ignore"))
        sys.exit(1)
    except URLError as e:
        print("Login connection error:", getattr(e, "reason", e))
        sys.exit(1)

    if not tok:
        print("No access token returned. Seed admin or check auth settings.")
        sys.exit(1)

    # Build request
    car_b64 = _read_file_b64_data_uri(interior_before)
    studio_b64 = _read_file_b64_data_uri(interior_after)
    body = json.dumps({
        "images": [car_b64],
        "studio_reference_data_uri": studio_b64,
        "pipeline_version": "11",
        "preview": True,
    }).encode("utf-8")

    req = urllib.request.Request(
        process_url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {tok}",
        },
        method="POST",
    )

    processed_b64 = None
    for event, data in _sse_stream(req):
        if event == "log":
            msg = (data or {}).get("message", "")
            if msg:
                print("[log]", msg)
        elif event == "result":
            processed_b64 = (data or {}).get("processed_b64")
            print("[result] received")
        elif event == "complete":
            print("[complete]", data)
            break

    if not processed_b64:
        print("FAIL: No processed image received")
        sys.exit(1)

    # Verify 4:3 aspect ratio via backend judge (deterministic-only).
    judged = _admin_judge_aspect_ratio(
        base=base,
        token=tok,
        original_b64=car_b64,
        processed_b64=processed_b64,
        metadata={"view_category": "interior"},
        expected_view_category="interior",
    )
    if judged.get("overall_pass"):
        print("PASS: Interior output is ~4:3 as expected (backend deterministic judge)")
        sys.exit(0)
    print("FAIL: Backend deterministic judge reported aspect ratio failure")
    sys.exit(3)


if __name__ == "__main__":
    main()
