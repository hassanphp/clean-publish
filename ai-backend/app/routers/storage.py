"""Storage API - S3, R2, or GCS presigned upload URLs."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.routers.auth import get_current_user
from app.models import User
from app.utils.storage import generate_presigned_upload_url
from app.utils.object_storage import get_object_reference

router = APIRouter(prefix="/api/v1/storage", tags=["storage"])


@router.get("/upload-url")
def get_upload_url(
    filename: str = Query(..., description="Object key (e.g. uploads/user123/abc.jpg)"),
    content_type: str = Query("image/jpeg", description="MIME type"),
    user: User = Depends(get_current_user),
):
    """
    Get a presigned URL to upload an image directly to S3/R2/GCS.
    Frontend uploads with PUT, then passes object_url to process-batch.
    """
    url = generate_presigned_upload_url(filename, content_type)
    if not url:
        raise HTTPException(
            status_code=503,
            detail="Storage not configured. Set GCS_BUCKET, or S3/R2 env vars (see docs/STORAGE-AND-BRANDING.md).",
        )
    object_url = get_object_reference(filename)
    return {"upload_url": url, "filename": filename, "object_url": object_url}
