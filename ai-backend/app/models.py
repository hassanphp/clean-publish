"""SQLAlchemy models for Users and Image Processing Jobs."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class DealerAssetType(str, enum.Enum):
    """Asset type for dealer branding."""
    LOGO = "logo"
    STUDIO = "studio"
    LICENSE_PLATE = "license_plate"


class LogoCornerPosition(str, enum.Enum):
    """Position for logo overlay in corner."""
    LEFT = "left"
    RIGHT = "right"


class Dealer(Base):
    """Dealer table - standalone (no User link required)."""

    __tablename__ = "dealers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    preferences = relationship("DealerPreferences", back_populates="dealer", uselist=False, cascade="all, delete-orphan")
    assets = relationship("DealerAsset", back_populates="dealer", cascade="all, delete-orphan")


class DealerPreferences(Base):
    """Dealer branding preferences."""

    __tablename__ = "dealer_preferences"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=False, index=True, unique=True)
    logo_corner_enabled = Column(Boolean, default=False)
    logo_corner_position = Column(String(16), default="right")  # left/right
    license_plate_enabled = Column(Boolean, default=False)
    logo_3d_wall_enabled = Column(Boolean, default=False)
    default_studio_id = Column(Integer, nullable=True)  # nullable FK to asset or preset
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dealer = relationship("Dealer", back_populates="preferences")


class DealerAsset(Base):
    """Dealer asset (logo, studio, license_plate) - stored as base64 or file path."""

    __tablename__ = "dealer_assets"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=False, index=True)
    asset_type = Column(String(32), nullable=False)  # logo, studio, license_plate
    file_path = Column(Text, nullable=True)  # optional path if stored on disk
    data_b64 = Column(Text, nullable=True)  # base64 content for small assets
    created_at = Column(DateTime, default=datetime.utcnow)

    dealer = relationship("Dealer", back_populates="assets")


class AsyncJobStatus(str, enum.Enum):
    """Status for webhook-based async jobs (V6/V7)."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AsyncJobImageStatus(str, enum.Enum):
    """Status for a single image in an async job."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    """User table for tracking who submitted jobs. Optional password_hash for JWT auth."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)  # For JWT auth (enterprise)
    name = Column(String(255), nullable=True)
    credits = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    jobs = relationship("Job", back_populates="user")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    """Enterprise: User project (batch of images)."""

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="Untitled")
    status = Column(String(32), default="draft")  # draft, active, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="projects")
    job_images = relationship("JobImage", back_populates="project", cascade="all, delete-orphan")


class JobImage(Base):
    """Enterprise: Single image in a project. Stores GCS URLs or base64."""

    __tablename__ = "job_images"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    image_index = Column(Integer, nullable=False)
    original_url = Column(Text, nullable=True)  # GCS URL or data URI
    processed_url = Column(Text, nullable=True)  # GCS URL or data URI
    status = Column(String(32), default="pending")  # pending, processing, completed, failed
    metadata_json = Column(Text, nullable=True)  # JSON AutomotiveImageMetadata
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="job_images")


class Job(Base):
    """Image processing job - tracks status, images, and Gemini metadata."""

    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(
        Enum(JobStatus),
        default=JobStatus.PENDING,
        nullable=False,
        index=True,
    )
    target_studio_description = Column(Text, nullable=True)

    # File paths (local) or GCS URIs (production) - stored as JSON array
    original_image_paths = Column(Text, nullable=True)  # JSON: ["path1", "path2"]
    processed_image_paths = Column(Text, nullable=True)  # JSON: ["path1", "path2"]

    # Gemini-extracted metadata per image - stored as JSON array
    gemini_metadata = Column(Text, nullable=True)  # JSON: [AutomotiveImageMetadata, ...]

    # Error message if status is FAILED
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="jobs")


class AsyncJob(Base):
    """Webhook-based async job (V6/V7). Groups images submitted to Fal/Replicate."""

    __tablename__ = "async_jobs"

    id = Column(String(36), primary_key=True, index=True)  # UUID
    status = Column(
        Enum(AsyncJobStatus),
        default=AsyncJobStatus.PENDING,
        nullable=False,
        index=True,
    )
    pipeline_version = Column(String(2), nullable=False)  # "6" or "7"
    target_studio_description = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=True, index=True)
    branding_options_json = Column(Text, nullable=True)  # JSON: logo_corner_enabled, logo_corner_position, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    images = relationship("AsyncJobImage", back_populates="job", cascade="all, delete-orphan")


class AsyncJobImage(Base):
    """Single image in an async job. Maps provider_job_id (Fal request_id / Replicate prediction_id) for webhooks."""

    __tablename__ = "async_job_images"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(36), ForeignKey("async_jobs.id"), nullable=False, index=True)
    image_index = Column(Integer, nullable=False)
    provider_job_id = Column(String(255), nullable=True, index=True)  # Fal request_id or Replicate prediction id
    provider = Column(String(32), nullable=True)  # "fal" or "replicate"
    status = Column(
        Enum(AsyncJobImageStatus),
        default=AsyncJobImageStatus.PENDING,
        nullable=False,
    )
    original_b64 = Column(Text, nullable=True)
    processed_b64 = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)  # JSON AutomotiveImageMetadata
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("AsyncJob", back_populates="images")


class FeatureFlag(Base):
    """Simple feature flag store (boolean or string)."""

    __tablename__ = "feature_flags"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(128), unique=True, index=True, nullable=False)
    value = Column(String(1024), nullable=False, default="true")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
