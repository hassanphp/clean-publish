"""Pydantic schemas for API and AI pipeline."""

from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator


class AutomotiveImageMetadata(BaseModel):
    """Strict schema for Gemini Vision output - automotive image analysis."""

    view_category: Literal["interior", "exterior", "detail"] = Field(
        description="Primary view: interior cabin, exterior shot, or detail/close-up"
    )
    camera_angle: str = Field(
        default="unknown",
        description="Exterior camera angle: side_profile, front_three_quarter, rear_three_quarter, front, rear",
    )
    components: list[str] = Field(
        default_factory=list,
        description="Detected components: leather, rims, screens, dashboard, seats, etc.",
    )
    existing_lighting: str = Field(
        default="unknown",
        description="Current lighting: natural, studio, mixed, dim, harsh, etc.",
    )
    dominant_color: str = Field(
        default="unknown",
        description="Dominant color of the vehicle or interior",
    )
    suggested_edit_mode: Literal["product-image", "inpainting-insert", "outpainting"] = (
        Field(
            default="product-image",
            description="Recommended Vertex edit mode based on view",
        )
    )


class ProcessBatchRequest(BaseModel):
    """Request body for batch image processing."""

    images: list[str] = Field(
        ...,
        description="Base64-encoded images (data URL or raw base64) or GCS URLs (https://storage.googleapis.com/...)",
    )
    target_studio_description: str | None = Field(
        default=None,
        description="User's desired studio/environment description (text)",
    )
    studio_reference_image: str | None = Field(
        default=None,
        description="Base64-encoded studio reference image - AI will analyze and extract environment",
    )
    studio_reference_data_uri: str | None = Field(
        default=None,
        description="V6: Base64 data URI of target studio environment for Fal.ai FLUX multi-image reference",
    )
    pipeline_version: Literal["1", "2", "3", "4", "5", "6", "7", "8", "10", "11"] = Field(
        default="11",
        description="V11=OpenAI-only (metadata + GPT Image 1.5) - default. Other versions available for compatibility.",
    )
    preview: bool = Field(
        default=False,
        description="When true (V11), downscale inputs to generate a cheaper low-res preview. Full-quality runs remain unchanged.",
    )
    user_email: str | None = Field(default=None, description="Optional user email")
    dealer_id: int | None = Field(default=None, description="Optional dealer ID - loads preferences and assets")
    project_id: int | None = Field(default=None, description="Optional project ID - links results to a project")
    branding_options: dict[str, Any] | None = Field(
        default=None,
        description="Optional branding: logo_b64 (data URL or base64), logo_corner_enabled, logo_3d_wall_enabled, license_plate_enabled",
    )

    @model_validator(mode="after")
    def require_studio_source(self):
        if self.pipeline_version in ("6", "7", "11"):
            if not self.studio_reference_data_uri and not self.studio_reference_image:
                raise ValueError(
                    "V6, V7 and V11 require studio_reference_data_uri or studio_reference_image for multi-image reference"
                )
            return self
        if not self.target_studio_description and not self.studio_reference_image:
            raise ValueError("Either target_studio_description or studio_reference_image is required")
        return self


class ModelInfo(BaseModel):
    """Which model generated the image - for display and regenerate."""

    provider: str = Field(description="Provider: fal, replicate, or vertex")
    model: str = Field(description="Model identifier e.g. fal-ai/flux-2-flex/edit")


class ProcessedImageResult(BaseModel):
    """Single processed image result."""

    index: int
    original_b64: str
    processed_b64: str
    metadata: AutomotiveImageMetadata
    error_message: str | None = None
    model_info: ModelInfo | None = Field(default=None, description="Which model generated this image")


class ProcessBatchResponse(BaseModel):
    """Final response after batch processing."""

    job_id: int
    status: Literal["completed", "failed"]
    results: list[ProcessedImageResult] = Field(default_factory=list)
    error_message: str | None = None


class RegenerateRequest(BaseModel):
    """Request to regenerate a single image with a different model."""

    original_b64: str = Field(..., description="Base64 image (data URL or raw)")
    metadata: dict = Field(..., description="Metadata from original result (view_category, components, etc.)")
    pipeline_version: Literal["1", "2", "3", "4", "6", "7", "8", "10", "11"] = Field(
        default="11",
        description="Pipeline version (V11=OpenAI GPT Image 1.5)",
    )
    target_studio_description: str = Field(..., description="Studio description for the edit")
    model: Literal["fal", "replicate", "vertex"] = Field(
        ...,
        description="Model to use for regeneration (overrides IMAGE_EDIT_PROVIDER)",
    )
    studio_reference_data_uri: str | None = Field(
        default=None,
        description="For V6/V7: studio reference image",
    )


# --- Dealer schemas ---


class DealerCreate(BaseModel):
    """Create dealer request."""

    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=1, max_length=255)


class DealerUpdate(BaseModel):
    """Update dealer request."""

    name: str | None = Field(None, min_length=1, max_length=255)
    email: str | None = Field(None, min_length=1, max_length=255)


class DealerPreferencesUpdate(BaseModel):
    """Upsert dealer preferences."""

    logo_corner_enabled: bool | None = None
    logo_corner_position: Literal["left", "right"] | None = None
    license_plate_enabled: bool | None = None
    logo_3d_wall_enabled: bool | None = None
    default_studio_id: int | None = None


class DealerPreferencesResponse(BaseModel):
    """Dealer preferences response."""

    logo_corner_enabled: bool
    logo_corner_position: str
    license_plate_enabled: bool
    logo_3d_wall_enabled: bool
    default_studio_id: int | None


class DealerAssetResponse(BaseModel):
    """Dealer asset response."""

    id: int
    asset_type: str
    file_path: str | None
    data_b64: str | None
    created_at: str


class DealerResponse(BaseModel):
    """Dealer response with preferences and assets."""

    id: int
    name: str
    email: str
    created_at: str
    updated_at: str
    preferences: DealerPreferencesResponse | None = None
    assets: list[DealerAssetResponse] = Field(default_factory=list)
