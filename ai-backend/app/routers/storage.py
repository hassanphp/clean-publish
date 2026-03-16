"""Storage API - GCS presigned upload URLs."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.routers.auth import get_current_user
from app.models import User
from app.utils.storage import generate_presigned_upload_url

router = APIRouter(prefix="/api/v1/storage", tags=["storage"])


@router.get("/upload-url")
def get_upload_url(
    filename: str = Query(..., description="Object key in GCS (e.g. uploads/user123/abc.jpg)"),
    content_type: str = Query("image/jpeg", description="MIME type"),
    user: User = Depends(get_current_user),
):
    """
    Get a presigned URL to upload an image directly to GCS.
    Frontend uploads with PUT and the returned URL.
    """
    url = generate_presigned_upload_url(filename, content_type)
    if not url:
        raise HTTPException(
            status_code=503,
            detail="GCS not configured. Set GCS_BUCKET and ensure service account has storage permissions.",
        )
    return {"upload_url": url, "filename": filename}
