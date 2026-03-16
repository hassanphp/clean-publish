"""Shared utilities."""


def sanitize_error(msg: str) -> str:
    """Remove model/provider names from error messages and logs shown to users."""
    if not msg:
        return msg
    for old, new in [
        ("Fal.ai", ""), ("Fal ", " "), ("fal.ai", ""), ("fal-ai", ""),
        ("Replicate", "Service"), ("FLUX", ""), ("Vertex", "Service"),
        ("OpenAI", "Service"), ("openai", "service"),
        ("gpt-image-1.5", ""), ("gpt-image-1", ""), ("gpt-image-1-mini", ""),
        ("gpt-4o-mini", ""), ("gpt-4o", ""),
        ("Imagen", ""), ("imagen-3", ""),
        ("reve/edit", ""), ("flux-2-flex", ""), ("flux-2-pro", ""),
    ]:
        msg = msg.replace(old, new)
    return " ".join(msg.split()).strip() or "Processing failed"
