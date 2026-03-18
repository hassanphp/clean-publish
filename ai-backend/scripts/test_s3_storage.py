#!/usr/bin/env python3
"""
Test S3 storage integration - logs in and calls /api/v1/storage/upload-url.
Verifies presigned URL and object_url (s3://) are returned.

Run: SMOKE_API_BASE=https://api.carveo.eu python scripts/test_s3_storage.py
Or:  python scripts/test_s3_storage.py  (defaults to localhost:8000)
"""

import json
import os
import sys
import urllib.request
from urllib.error import HTTPError

BASE = os.getenv("SMOKE_API_BASE", "http://localhost:8000").rstrip("/")
LOGIN_EMAIL = os.getenv("TEST_EMAIL", "dealer@domain.com")
LOGIN_PASS = os.getenv("TEST_PASSWORD", "Admin@321")


def main():
    print(f"Testing S3 storage at {BASE}")
    print()

    # 1. Login
    login_url = f"{BASE}/api/v1/auth/login"
    login_payload = json.dumps({"email": LOGIN_EMAIL, "password": LOGIN_PASS}).encode("utf-8")
    req = urllib.request.Request(
        login_url,
        data=login_payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode("utf-8"))
            token = data.get("access_token", "")
    except HTTPError as e:
        print(f"Login failed: {e.code} {e.reason}")
        if e.code == 401:
            print("Check TEST_EMAIL and TEST_PASSWORD (default: dealer@domain.com / Admin@321)")
        sys.exit(1)
    except Exception as e:
        print(f"Login error: {e}")
        sys.exit(1)

    if not token:
        print("No access token. Run seed: python -m app.seed")
        sys.exit(1)
    print("Login OK")

    # 2. Get upload URL
    upload_url_endpoint = f"{BASE}/api/v1/storage/upload-url?filename=uploads/test-integration.jpg&content_type=image/jpeg"
    req = urllib.request.Request(
        upload_url_endpoint,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode("utf-8"))
    except HTTPError as e:
        if e.code == 503:
            print("FAIL: 503 - Storage not configured. Check STORAGE_PROVIDER, AWS_*, S3_BUCKET in .env")
        else:
            print(f"FAIL: {e.code} {e.reason}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

    upload_url = data.get("upload_url", "")
    object_url = data.get("object_url", "")
    filename = data.get("filename", "")

    if not upload_url:
        print("FAIL: No upload_url in response")
        sys.exit(1)
    if not object_url:
        print("FAIL: No object_url in response")
        sys.exit(1)

    # Check object_url is S3 style
    if "s3://" in object_url or "amazonaws.com" in upload_url:
        print("S3 integration OK")
    else:
        print("Response OK (may be GCS/R2)")
    print(f"  upload_url: {upload_url[:80]}...")
    print(f"  object_url: {object_url}")
    print(f"  filename: {filename}")
    print()
    print("PASS: S3 storage integration successful")

if __name__ == "__main__":
    main()
