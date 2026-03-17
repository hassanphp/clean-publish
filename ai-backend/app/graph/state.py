"""LangGraph state definition with Map-Reduce pattern."""

import operator
from typing import Annotated, TypedDict

from app.schemas import AutomotiveImageMetadata


class ImageItem(TypedDict, total=False):
    """Single image with index for map-reduce. Use image_url for GCS (avoids base64)."""

    index: int
    bytes_b64: str
    mime_type: str
    image_url: str  # GCS or signed URL - passed to Fal/Replicate


class ProcessedItem(TypedDict):
    """Processed image result."""

    index: int
    original_b64: str
    processed_b64: str
    metadata: AutomotiveImageMetadata


class VertexPayload(TypedDict, total=False):
    """Vertex AI request payload for one image."""

    index: int
    base_image_b64: str
    car_image_url: str  # GCS/signed URL - Fal/Replicate download directly
    prompt: str
    edit_mode: str
    mask_mode: str
    guidance_scale: int
    base_steps: int
    metadata: AutomotiveImageMetadata


class GraphState(TypedDict, total=False):
    """Map-Reduce state for concurrent image processing."""

    images: list[ImageItem]
    target_studio_description: str
    pipeline_version: str  # "1", "2", or "3"
    studio_reference_b64: str | None  # For V3 remove-bg composite
    preview: bool  # When True, generate a cheaper low-res preview (does not affect full-quality runs)
    dealer_branding: dict | None  # For V6/V7: logo for 3D wall (model-generated)
    model_override: str | None  # For regenerate: "fal" | "replicate" | "vertex"
    # Accumulated via operator.add (reducer)
    metadata: Annotated[list[tuple[int, AutomotiveImageMetadata]], operator.add]
    # Built from metadata
    vertex_payloads: list[VertexPayload]
    # Accumulated results
    results: Annotated[list[ProcessedItem], operator.add]
    # Progress logs for SSE
    logs: Annotated[list[str], operator.add]
    # Final status
    error: str | None
