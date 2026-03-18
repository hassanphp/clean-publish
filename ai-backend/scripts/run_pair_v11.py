#!/usr/bin/env python3
"""
Run a single V11 job with local files (car + studio reference), stream SSE, and save the result.

Usage on EC2 (after copying files to the server):
  cd ~/clean-publish/ai-backend
  source venv/bin/activate
  python scripts/run_pair_v11.py \
    --car ./tmp/my-exterior.jpg \
    --studio ./tmp/my-studio.jpg \
    --out ./tmp/result.jpg

Env overrides:
  SMOKE_API_BASE=http://127.0.0.1:8000  (default)

Notes:
  - Logs in using the seeded admin (dealer@domain.com / Admin@321)
  - Sets pipeline_version=11 and preview=True by default
"""

import argparse
import base64
import io
import json
import os
import sys
import urllib.request
from urllib.error import HTTPError, URLError


def _to_data_uri(path: str) -> str:
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
            raw = f.read()
        b64 = base64.b64encode(raw).decode("ascii")
        ext = os.path.splitext(path)[1].lower().lstrip(".")
        mime = "image/jpeg" if ext in ("jpg", "jpeg", "jfif") else (
            "image/png" if ext == "png" else "image/webp"
        )
        return f"data:{mime};base64,{b64}"


def _sse(req: urllib.request.Request):
    with urllib.request.urlopen(req, timeout=600) as resp:
        ctype = resp.headers.get("content-type", "")
        if "application/json" in ctype:
            data = json.loads(resp.read().decode("utf-8"))
            yield ("message", data)
            return
        buf = b""
        event = ""
        while True:
            chunk = resp.read(2048)
            if not chunk:
                break
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                line = line.decode("utf-8", "ignore").strip()
                if not line:
                    continue
                if line.startswith("event:"):
                    event = line[6:].strip()
                elif line.startswith("data:"):
                    data_str = line[5:].strip()
                    try:
                        data = json.loads(data_str)
                    except Exception:
                        data = {"raw": data_str}
                    yield (event or "message", data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--car", required=True, help="Path to exterior image")
    ap.add_argument("--studio", required=True, help="Path to studio image")
    ap.add_argument("--out", default="./tmp/result.jpg", help="Where to save processed image")
    ap.add_argument("--pipeline", default="11", help="Pipeline version (default 11)")
    ap.add_argument("--preview", action="store_true", default=True, help="Use preview downscale (default true)")
    args = ap.parse_args()

    base = os.environ.get("SMOKE_API_BASE", "http://127.0.0.1:8000")
    login_url = base.rstrip("/") + "/api/v1/auth/login"
    proc_url = base.rstrip("/") + "/api/v1/process-batch"

    # Login seeded admin
    try:
        req = urllib.request.Request(
            login_url,
            data=json.dumps({"email": "dealer@domain.com", "password": "Admin@321"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            token = json.loads(r.read().decode("utf-8")).get("access_token", "")
    except (HTTPError, URLError) as e:
        print("Login failed:", e)
        sys.exit(1)
    if not token:
        print("No token; seed admin first (python -m app.seed)")
        sys.exit(1)

    car_b64 = _to_data_uri(args.car)
    studio_b64 = _to_data_uri(args.studio)
    body = json.dumps({
        "images": [car_b64],
        "studio_reference_data_uri": studio_b64,
        "pipeline_version": args.pipeline,
        "preview": True,
    }).encode("utf-8")

    req = urllib.request.Request(
        proc_url,
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )

    processed_b64 = None
    meta = None
    for ev, data in _sse(req):
        if ev == "log":
            msg = (data or {}).get("message", "")
            if msg:
                print("[log]", msg)
        elif ev == "result":
            processed_b64 = (data or {}).get("processed_b64")
            meta = (data or {}).get("metadata")
            print("[result] received")
        elif ev == "complete":
            print("[complete]", data)
            break

    if not processed_b64:
        print("FAIL: No processed image returned")
        sys.exit(1)

    # Save to file
    raw = processed_b64.split(",", 1)[-1]
    out_dir = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    with open(args.out, "wb") as f:
        f.write(base64.b64decode(raw))
    print(f"Saved: {args.out}")
    if meta:
        print("Metadata:", json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
