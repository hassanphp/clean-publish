"""
Unified object storage: S3, R2 (S3-compatible), or GCS.
Use STORAGE_PROVIDER=s3|r2|gcs. Falls back to GCS if only GCS_BUCKET set.
"""

import os
from datetime import timedelta
from typing import Optional

PROVIDER = os.getenv("STORAGE_PROVIDER", "").lower()
GCS_BUCKET = os.getenv("GCS_BUCKET", "")
S3_BUCKET = os.getenv("S3_BUCKET", os.getenv("R2_BUCKET", ""))
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")  # e.g. https://pub-xxx.r2.dev
PRESIGNED_EXPIRY_MINUTES = 15
SIGNED_READ_EXPIRY_MINUTES = 60


def _detect_provider() -> str:
    if PROVIDER in ("s3", "r2"):
        return PROVIDER
    if PROVIDER == "gcs" or GCS_BUCKET:
        return "gcs"
    if S3_BUCKET or R2_ACCOUNT_ID:
        return "r2" if R2_ACCOUNT_ID else "s3"
    return ""


def generate_presigned_upload_url(filename: str, content_type: str = "image/jpeg") -> Optional[str]:
    """Generate presigned URL for direct client upload. Returns None if not configured."""
    p = _detect_provider()
    if p == "r2":
        return _r2_presigned_upload(filename, content_type)
    if p == "s3":
        return _s3_presigned_upload(filename, content_type)
    if p == "gcs":
        return _gcs_presigned_upload(filename, content_type)
    return None


def generate_signed_read_url(url_or_path: str, expiration_minutes: int = SIGNED_READ_EXPIRY_MINUTES) -> Optional[str]:
    """Generate signed read URL. Accepts s3://, r2://, gs://, or https URLs."""
    p = _detect_provider()
    if p == "r2":
        return _r2_signed_read(url_or_path, expiration_minutes)
    if p == "s3":
        return _s3_signed_read(url_or_path, expiration_minutes)
    if p == "gcs":
        return _gcs_signed_read(url_or_path, expiration_minutes)
    return None


def get_public_url(key: str) -> Optional[str]:
    """Get public URL for object (R2 public bucket or S3 public)."""
    if R2_PUBLIC_URL:
        return f"{R2_PUBLIC_URL.rstrip('/')}/{key}"
    return None


def get_object_reference(filename: str) -> str:
    """
    Return persistent URL/key for the object after upload.
    Client passes this to process-batch. Backend uses it to generate signed read when needed.
    """
    p = _detect_provider()
    if p == "r2" and R2_PUBLIC_URL:
        return f"{R2_PUBLIC_URL.rstrip('/')}/{filename}"
    if p == "r2" or p == "s3":
        # Use s3:// style - backend will generate signed read
        return f"s3://{S3_BUCKET}/{filename}"
    if p == "gcs":
        return f"gs://{GCS_BUCKET}/{filename}"
    return f"gs://{GCS_BUCKET}/{filename}"  # fallback


# --- R2 (S3-compatible) ---

def _r2_client():
    import boto3
    from botocore.config import Config
    region = os.getenv("AWS_REGION", "auto")
    endpoint = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com" if R2_ACCOUNT_ID else None
    return boto3.client(
        "s3",
        region_name=region,
        endpoint_url=endpoint,
        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID", os.getenv("AWS_ACCESS_KEY_ID", "")),
        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY", os.getenv("AWS_SECRET_ACCESS_KEY", "")),
        config=Config(signature_version="s3v4"),
    )


def _r2_presigned_upload(filename: str, content_type: str) -> Optional[str]:
    if not S3_BUCKET:
        return None
    try:
        client = _r2_client()
        return client.generate_presigned_url(
            "put_object",
            Params={"Bucket": S3_BUCKET, "Key": filename, "ContentType": content_type},
            ExpiresIn=PRESIGNED_EXPIRY_MINUTES * 60,
        )
    except Exception:
        return None


def _r2_signed_read(url_or_path: str, expiration_minutes: int) -> Optional[str]:
    if not S3_BUCKET:
        return None
    try:
        key = _extract_key_from_url(url_or_path, "r2")
        if not key:
            return None
        client = _r2_client()
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": key},
            ExpiresIn=expiration_minutes * 60,
        )
    except Exception:
        return None


# --- S3 ---

def _s3_client():
    import boto3
    return boto3.client(
        "s3",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", ""),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", ""),
    )


def _s3_presigned_upload(filename: str, content_type: str) -> Optional[str]:
    if not S3_BUCKET:
        return None
    try:
        client = _s3_client()
        return client.generate_presigned_url(
            "put_object",
            Params={"Bucket": S3_BUCKET, "Key": filename, "ContentType": content_type},
            ExpiresIn=PRESIGNED_EXPIRY_MINUTES * 60,
        )
    except Exception:
        return None


def _s3_signed_read(url_or_path: str, expiration_minutes: int) -> Optional[str]:
    if not S3_BUCKET:
        return None
    try:
        key = _extract_key_from_url(url_or_path, "s3")
        if not key:
            return None
        client = _s3_client()
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": key},
            ExpiresIn=expiration_minutes * 60,
        )
    except Exception:
        return None


def _extract_key_from_url(url_or_path: str, provider: str) -> Optional[str]:
    """Extract object key from s3://, https://bucket.s3.region.amazonaws.com/key, or r2 public URL."""
    if url_or_path.startswith("s3://"):
        parts = url_or_path.replace("s3://", "").split("/", 1)
        return parts[1] if len(parts) > 1 else ""
    if url_or_path.startswith("r2://"):
        parts = url_or_path.replace("r2://", "").split("/", 1)
        return parts[1] if len(parts) > 1 else ""
    from urllib.parse import urlparse
    parsed = urlparse(url_or_path)
    path = parsed.path.lstrip("/")
    if path:
        return path
    return None


# --- GCS ---

def _gcs_presigned_upload(filename: str, content_type: str) -> Optional[str]:
    if not GCS_BUCKET:
        return None
    try:
        from google.cloud import storage
        client = storage.Client()
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(filename)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=PRESIGNED_EXPIRY_MINUTES),
            method="PUT",
            content_type=content_type,
        )
    except Exception:
        return None


def _gcs_signed_read(url_or_path: str, expiration_minutes: int) -> Optional[str]:
    if not GCS_BUCKET:
        return None
    try:
        from google.cloud import storage
        from urllib.parse import urlparse
        if url_or_path.startswith("gs://"):
            parts = url_or_path.replace("gs://", "").split("/", 1)
            bucket_name, blob_path = parts[0], parts[1] if len(parts) > 1 else ""
        elif "storage.googleapis.com" in url_or_path:
            parsed = urlparse(url_or_path)
            path_parts = parsed.path.lstrip("/").split("/", 1)
            bucket_name = path_parts[0] if path_parts else ""
            blob_path = path_parts[1] if len(path_parts) > 1 else ""
        else:
            return None
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method="GET",
        )
    except Exception:
        return None
