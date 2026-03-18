#!/usr/bin/env python3
"""
Smoke test for V11 pipeline (EXTERIOR):
- Logs in with seeded admin to obtain JWT
- Uses demo exterior input and a studio reference image
- Streams SSE from /api/v1/process-batch
- Verifies processed result is received (full studio, no crop)

Run on EC2:
  cd ~/clean-publish/ai-backend
  source venv/bin/activate
  python scripts/smoke_v11_exterior.py
"""

import base64
import io
import json
import os
import sys
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
            b64 = base64.b64encode(f.read()).decode("ascii")
            # best-effort guess
            ext = os.path.splitext(path)[1].lower().lstrip(".") or "jpeg"
            mime = "image/jpeg" if ext in ("jpg", "jpeg", "jfif") else (
                "image/png" if ext == "png" else "image/webp"
            )
            return f"data:{mime};base64,{b64}"


def _sse_stream(req: urllib.request.Request):
    with urllib.request.urlopen(req, timeout=300) as resp:
        ctype = resp.headers.get("content-type", "")
        if "application/json" in ctype:
            data = json.loads(resp.read().decode("utf-8"))
            yield ("message", data)
            return
        buff = b""
        current_event = ""
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

    # Locate demo assets
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_demo = os.path.abspath(os.path.join(repo_root, "..", "ai-frontend", "public", "demo"))
    studios_dir = os.path.abspath(os.path.join(repo_root, "..", "ai-frontend", "public", "studios"))
    car_path = os.path.join(frontend_demo, "exterior-before.jpg")
    # Allow overriding studio file via env or argv[1]
    studio_basename = os.environ.get("SMOKE_STUDIO_FILE") or (sys.argv[1] if len(sys.argv) > 1 else "studio-1.png")
    studio_path = studio_basename if os.path.isabs(studio_basename) else os.path.join(studios_dir, studio_basename)
    if not (os.path.exists(car_path) and os.path.exists(studio_path)):
        print("Demo exterior or studio image missing:")
        print("  car:", car_path)
        print("  studio:", studio_path)
        sys.exit(2)

    # Login
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

    car_b64 = _read_file_b64_data_uri(car_path)
    studio_b64 = _read_file_b64_data_uri(studio_path)

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

    # Verify exterior output is ~4:3 (cropped to fill frame)
    try:
        raw = processed_b64.split(",", 1)[-1]
        img_bytes = base64.b64decode(raw)
        from PIL import Image  # type: ignore

        with Image.open(io.BytesIO(img_bytes)) as im:
            w, h = im.size
        ratio = w / h if h else 0
        ok = abs(ratio - 4 / 3) < 0.05
        print(f"Processed size: {w}x{h} ratio={ratio:.3f}")
        if ok:
            print("PASS: Exterior ~4:3")
        else:
            print("WARN: Exterior not ~4:3")
        sys.exit(0 if ok else 3)
    except Exception as e:
        print("FAIL: Could not decode processed image:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
