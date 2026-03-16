"""Google Cloud Storage - presigned upload URLs."""

import os
from datetime import timedelta

GCS_BUCKET = os.getenv("GCS_BUCKET", "")
PRESIGNED_EXPIRY_MINUTES = 15


def generate_presigned_upload_url(filename: str, content_type: str = "image/jpeg") -> str | None:
    """
    Generate a presigned URL for uploading a file to GCS.
    Valid for 15 minutes. Returns None if GCS_BUCKET is not configured or google-cloud-storage is not installed.
    """
    if not GCS_BUCKET:
        return None
    try:
        from google.cloud import storage
    except ImportError:
        return None
    client = storage.Client()
    bucket = client.bucket(GCS_BUCKET)
    blob = bucket.blob(filename)
    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=PRESIGNED_EXPIRY_MINUTES),
        method="PUT",
        content_type=content_type,
    )
    return url


def generate_signed_read_url(gcs_url_or_path: str, expiration_minutes: int = 60) -> str | None:
    """
    Generate a signed URL for reading from GCS.
    Accepts https://storage.googleapis.com/bucket/path or gs://bucket/path.
    Use when passing GCS objects to Fal/Replicate (private bucket).
    """
    if not GCS_BUCKET:
        return None
    try:
        from google.cloud import storage
        from urllib.parse import urlparse
    except ImportError:
        return None
    if gcs_url_or_path.startswith("gs://"):
        parts = gcs_url_or_path.replace("gs://", "").split("/", 1)
    elif "storage.googleapis.com" in gcs_url_or_path:
        parsed = urlparse(gcs_url_or_path)
        path_parts = parsed.path.lstrip("/").split("/", 1)
        parts = path_parts if len(path_parts) >= 2 else (path_parts[0], "")
    else:
        return None
    bucket_name, blob_path = parts[0], parts[1] if len(parts) > 1 else ""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=expiration_minutes),
        method="GET",
    )
