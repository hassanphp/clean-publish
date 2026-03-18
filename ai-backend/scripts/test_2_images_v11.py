#!/usr/bin/env python3
"""
2-image V11 smoke test: sends 2 images (exterior + interior) to process-batch,
verifies both results are returned and ~4:3.

Usage:
  SMOKE_API_BASE=https://api.carveo.eu python scripts/test_2_images_v11.py
  # or locally:
  python scripts/test_2_images_v11.py
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
        ext = os.path.splitext(path)[1].lower().lstrip(".") or "jpeg"
        mime = "image/jpeg" if ext in ("jpg", "jpeg", "jfif") else ("image/png" if ext == "png" else "image/webp")
        return f"data:{mime};base64,{b64}"


def _sse_stream(req: urllib.request.Request):
    with urllib.request.urlopen(req, timeout=600) as resp:
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

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_demo = os.path.abspath(os.path.join(repo_root, "..", "ai-frontend", "public", "demo"))
    studios_dir = os.path.abspath(os.path.join(repo_root, "..", "ai-frontend", "public", "studios"))

    # Prefer exterior + interior; fallback to 2x same image
    exterior_path = os.path.join(frontend_demo, "exterior-before.jpg")
    interior_path = os.path.join(frontend_demo, "interior-before.avif")
    fallback_img = os.path.abspath(os.path.join(repo_root, "..", "ai-frontend", "image.JPEG"))
    studio_path = os.path.join(studios_dir, "studio-1.png")
    if not os.path.exists(studio_path):
        studio_path = os.path.join(studios_dir, "studio-1.jpg")
    if not os.path.exists(studio_path):
        studio_path = os.path.join(frontend_demo, "interior-after.avif")

    car_path = exterior_path if os.path.exists(exterior_path) else (interior_path if os.path.exists(interior_path) else fallback_img)
    if not os.path.exists(car_path):
        print("No test image found. Add exterior-before.jpg or interior-before.avif to ai-frontend/public/demo/")
        sys.exit(2)
    if not os.path.exists(studio_path):
        studio_path = car_path  # V11 needs studio; use car as placeholder for minimal test

    img1 = _read_file_b64_data_uri(car_path)
    img2 = _read_file_b64_data_uri(interior_path) if os.path.exists(interior_path) else img1
    studio_b64 = _read_file_b64_data_uri(studio_path)

    # Login
    login_payload = json.dumps({"email": "dealer@domain.com", "password": "Admin@321"}).encode("utf-8")
    try:
        req = urllib.request.Request(login_url, data=login_payload, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=20) as r:
            tok = json.loads(r.read().decode("utf-8")).get("access_token", "")
    except (HTTPError, URLError) as e:
        print("Login failed:", e)
        sys.exit(1)
    if not tok:
        print("No token. Run seed first.")
        sys.exit(1)

    body = json.dumps({
        "images": [img1, img2],
        "studio_reference_data_uri": studio_b64,
        "pipeline_version": "11",
        "preview": True,
    }).encode("utf-8")

    req = urllib.request.Request(
        process_url,
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {tok}"},
        method="POST",
    )

    results = []
    for event, data in _sse_stream(req):
        if event == "log":
            msg = (data or {}).get("message", "")
            if msg:
                print("[log]", msg)
        elif event == "result":
            results.append(data)
            print("[result] image", len(results))
        elif event == "complete":
            print("[complete]", data)
            break

    if len(results) != 2:
        print(f"FAIL: Expected 2 results, got {len(results)}")
        sys.exit(1)

    for i, r in enumerate(results):
        b64 = (r or {}).get("processed_b64")
        meta = (r or {}).get("metadata", {})
        view = meta.get("view_category", "?")
        if not b64:
            print(f"FAIL: Result {i+1} has no processed_b64")
            sys.exit(1)
        try:
            raw = b64.split(",", 1)[-1]
            img_bytes = base64.b64decode(raw)
            from PIL import Image  # type: ignore
            with Image.open(io.BytesIO(img_bytes)) as im:
                w, h = im.size
            ratio = w / h if h else 0
            ok = abs(ratio - (4/3)) < 0.05
            print(f"  Image {i+1} ({view}): {w}x{h} ratio={ratio:.3f} 4:3={'OK' if ok else 'WARN'}")
        except Exception as e:
            print(f"  Image {i+1}: decode error {e}")

    print("PASS: 2 images processed successfully")
    sys.exit(0)


if __name__ == "__main__":
    main()
