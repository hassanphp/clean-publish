"""Storage - S3, R2, or GCS. Unified interface via object_storage."""

from app.utils.object_storage import (
    generate_presigned_upload_url,
    generate_signed_read_url,
)

__all__ = ["generate_presigned_upload_url", "generate_signed_read_url"]
