"""Project CRUD API - JWT protected."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, JobImage
from app.routers.auth import get_current_user
from app.models import User
from app.utils.storage import generate_signed_read_url

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _maybe_wrap_base64_as_data_url(v: str | None, *, mime: str = "image/jpeg") -> str | None:
    """
    The frontend may send raw base64 (no `data:` prefix) into `original_url` /
    `processed_url`. The projects UI uses these values directly as `img src`,
    so we must wrap them as data URLs.
    """
    if not v:
        return None
    if v.startswith("data:") or v.startswith("http://") or v.startswith("https://"):
        return v
    # Keep object-storage-style URIs as-is (we sign them later if needed).
    if "://" in v or v.startswith(("s3://", "gs://", "r2://")):
        return v

    vv = v.strip().replace("\n", "").replace("\r", "")
    if len(vv) < 32:
        return v

    import re

    # Base64 heuristic (accept standard + URL-safe chars).
    if re.fullmatch(r"[A-Za-z0-9+/=_-]+", vv):
        return f"data:{mime};base64,{vv}"
    return v


def _maybe_signed(url: str | None) -> str | None:
    """If url is from object storage (s3://, gs://, r2://), return a signed http(s) read URL.
    If it is already a data/http(s) URL, return as-is.
    """
    if not url:
        return None
    if url.startswith("data:") or url.startswith("http://") or url.startswith("https://"):
        return url
    signed = generate_signed_read_url(url)
    return signed or url


class ProjectCreate(BaseModel):
    """Create project request."""

    title: str = Field(default="Untitled", min_length=1, max_length=255)


class ProjectUpdate(BaseModel):
    """Update project request."""

    title: str | None = Field(None, min_length=1, max_length=255)
    status: Literal["draft", "active", "completed", "failed"] | None = None


class ProjectResponse(BaseModel):
    """Project response."""

    id: int
    user_id: int
    title: str
    status: str
    created_at: str
    updated_at: str
    thumbnail_url: str | None = None


class JobImageResponse(BaseModel):
    """Job image response."""

    id: int
    project_id: int
    image_index: int
    original_url: str | None
    processed_url: str | None
    status: str
    error_message: str | None
    created_at: str


class JobImageCreate(BaseModel):
    """Create/upsert job image."""

    image_index: int
    original_url: str | None = None
    processed_url: str | None = None
    status: str = "completed"


class JobImagesUpsert(BaseModel):
    """Upsert job images for a project."""

    images: list[JobImageCreate]


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: str | None = Query(None, description="Filter by status"),
):
    """List projects for the current user."""
    q = db.query(Project).filter(Project.user_id == user.id)
    if status:
        q = q.filter(Project.status == status)
    projects = q.order_by(Project.updated_at.desc()).all()
    return [
        ProjectResponse(
            id=p.id,
            user_id=p.user_id,
            title=p.title,
            status=p.status,
            created_at=p.created_at.isoformat() if p.created_at else "",
            updated_at=p.updated_at.isoformat() if p.updated_at else "",
            thumbnail_url=_project_thumbnail(db, p.id),
        )
        for p in projects
    ]


@router.post("", response_model=ProjectResponse)
def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project."""
    project = Project(user_id=user.id, title=body.title, status="draft")
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        title=project.title,
        status=project.status,
        created_at=project.created_at.isoformat() if project.created_at else "",
        updated_at=project.updated_at.isoformat() if project.updated_at else "",
        thumbnail_url=None,
    )


def _project_thumbnail(db: Session, project_id: int) -> str | None:
    thumb = (
        db.query(JobImage.processed_url)
        .filter(JobImage.project_id == project_id, JobImage.processed_url.isnot(None))
        .order_by(JobImage.image_index)
        .limit(1)
        .scalar()
    )
    return _maybe_signed(thumb)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        title=project.title,
        status=project.status,
        created_at=project.created_at.isoformat() if project.created_at else "",
        updated_at=project.updated_at.isoformat() if project.updated_at else "",
        thumbnail_url=_project_thumbnail(db, project_id),
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.title is not None:
        project.title = body.title
    if body.status is not None:
        project.status = body.status
    db.commit()
    db.refresh(project)
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        title=project.title,
        status=project.status,
        created_at=project.created_at.isoformat() if project.created_at else "",
        updated_at=project.updated_at.isoformat() if project.updated_at else "",
        thumbnail_url=_project_thumbnail(db, project_id),
    )


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Explicitly delete job images to avoid any ORM cascade edge-cases.
    db.query(JobImage).filter(JobImage.project_id == project_id).delete()
    db.delete(project)
    db.commit()
    return None


@router.post("/{project_id}/images", response_model=list[JobImageResponse])
def upsert_project_images(
    project_id: int,
    body: JobImagesUpsert,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or replace job images for a project. Updates project status to completed."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Replace existing images
    db.query(JobImage).filter(JobImage.project_id == project_id).delete()
    for img in body.images:
        ji = JobImage(
            project_id=project_id,
            image_index=img.image_index,
            # Ensure browser-renderable `img src` values.
            original_url=_maybe_wrap_base64_as_data_url(img.original_url),
            processed_url=_maybe_wrap_base64_as_data_url(img.processed_url),
            status=img.status,
        )
        db.add(ji)
    project.status = "completed"
    db.commit()
    images = db.query(JobImage).filter(JobImage.project_id == project_id).order_by(JobImage.image_index).all()
    return [
        JobImageResponse(
            id=ji.id,
            project_id=ji.project_id,
            image_index=ji.image_index,
            original_url=ji.original_url,
            processed_url=ji.processed_url,
            status=ji.status,
            error_message=ji.error_message,
            created_at=ji.created_at.isoformat() if ji.created_at else "",
        )
        for ji in images
    ]


@router.get("/{project_id}/images", response_model=list[JobImageResponse])
def get_project_images(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List images in a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    images = db.query(JobImage).filter(JobImage.project_id == project_id).order_by(JobImage.image_index).all()
    return [
        JobImageResponse(
            id=ji.id,
            project_id=ji.project_id,
            image_index=ji.image_index,
            original_url=_maybe_signed(ji.original_url),
            processed_url=_maybe_signed(ji.processed_url),
            status=ji.status,
            error_message=ji.error_message,
            created_at=ji.created_at.isoformat() if ji.created_at else "",
        )
        for ji in images
    ]
