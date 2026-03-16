"""Branding utilities - logo overlay on processed images."""

import base64
from typing import Literal

import cv2
import numpy as np


def brighten_image_b64(b64_str: str, gamma: float = 0.82) -> str:
    """Apply gamma correction to brighten image. gamma < 1 brightens. Returns base64 JPEG."""
    try:
        raw = b64_str.split(",", 1)[-1] if "," in b64_str else b64_str
        img_bytes = base64.b64decode(raw)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return b64_str
        inv_gamma = 1.0 / gamma
        lut = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype(np.uint8)
        brightened = cv2.LUT(img, lut)
        _, buf = cv2.imencode(".jpg", brightened, [cv2.IMWRITE_JPEG_QUALITY, 92])
        return base64.b64encode(buf.tobytes()).decode()
    except Exception:
        return b64_str


def _decode_and_resize_logo(
    image_b64: str,
    logo_b64: str,
    target_size: int,
) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Decode image and logo, resize logo. Returns (img, logo_resized) or (None, None)."""
    raw_img = image_b64.split(",", 1)[-1] if "," in image_b64 else image_b64
    raw_logo = logo_b64.split(",", 1)[-1] if "," in logo_b64 else logo_b64
    img_bytes = base64.b64decode(raw_img)
    logo_bytes = base64.b64decode(raw_logo)
    img_arr = np.frombuffer(img_bytes, np.uint8)
    logo_arr = np.frombuffer(logo_bytes, np.uint8)
    img = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)
    logo = cv2.imdecode(logo_arr, cv2.IMREAD_UNCHANGED)
    if img is None or logo is None:
        return None, None
    logo_h, logo_w = logo.shape[:2]
    scale = target_size / max(logo_h, logo_w)
    new_logo_w = int(logo_w * scale)
    new_logo_h = int(logo_h * scale)
    logo_resized = cv2.resize(logo, (new_logo_w, new_logo_h), interpolation=cv2.INTER_AREA)
    return img, logo_resized


def overlay_logo_corner(
    image_b64: str,
    logo_b64: str,
    position: Literal["left", "right"] = "right",
    size_ratio: float = 0.10,
    view_category: str = "exterior",
) -> str:
    """
    Overlay a square logo in the corner of an image.
    For exterior: use BOTTOM corner (floor area) to avoid overlapping the car.
    For detail/interior: use top corner.
    Returns base64 JPEG.
    """
    raw_img = image_b64.split(",", 1)[-1] if "," in image_b64 else image_b64
    raw_logo = logo_b64.split(",", 1)[-1] if "," in logo_b64 else logo_b64
    img_bytes = base64.b64decode(raw_img)
    logo_bytes = base64.b64decode(raw_logo)
    img_arr = np.frombuffer(img_bytes, np.uint8)
    logo_arr = np.frombuffer(logo_bytes, np.uint8)
    img = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)
    logo = cv2.imdecode(logo_arr, cv2.IMREAD_UNCHANGED)
    if img is None or logo is None:
        return image_b64
    h, w = img.shape[:2]
    logo_h, logo_w = logo.shape[:2]
    target_size = max(32, min(int(w * size_ratio), 180))
    scale = target_size / max(logo_h, logo_w)
    new_logo_w = int(logo_w * scale)
    new_logo_h = int(logo_h * scale)
    logo_resized = cv2.resize(logo, (new_logo_w, new_logo_h), interpolation=cv2.INTER_AREA)
    margin = max(8, int(w * 0.02))
    if position == "left":
        x = margin
    else:
        x = w - new_logo_w - margin
    if view_category == "exterior":
        y = h - new_logo_h - margin
    else:
        y = margin
    if len(logo_resized.shape) == 3 and logo_resized.shape[2] == 4:
        alpha = logo_resized[:, :, 3:4] / 255.0
        logo_rgb = logo_resized[:, :, :3]
        roi = img[y : y + new_logo_h, x : x + new_logo_w]
        blended = (alpha * logo_rgb + (1 - alpha) * roi).astype(np.uint8)
        img[y : y + new_logo_h, x : x + new_logo_w] = blended
    else:
        logo_rgb = logo_resized[:, :, :3] if len(logo_resized.shape) == 3 else cv2.cvtColor(logo_resized, cv2.COLOR_GRAY2BGR)
        img[y : y + new_logo_h, x : x + new_logo_w] = logo_rgb
    _, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf.tobytes()).decode()


def overlay_logo_license_plate(
    image_b64: str,
    logo_b64: str,
    size_ratio: float = 0.08,
) -> str:
    """
    Clean the license plate area (inpaint to remove existing text), then overlay
    logo sized to fit the plate. Plate region: center, ~60-75% from top (bumper).
    EU plate aspect ~5:1. Returns base64 JPEG.
    """
    raw_img = image_b64.split(",", 1)[-1] if "," in image_b64 else image_b64
    raw_logo = logo_b64.split(",", 1)[-1] if "," in logo_b64 else logo_b64
    img_bytes = base64.b64decode(raw_img)
    logo_bytes = base64.b64decode(raw_logo)
    img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
    logo = cv2.imdecode(np.frombuffer(logo_bytes, np.uint8), cv2.IMREAD_UNCHANGED)
    if img is None or logo is None:
        return image_b64
    h, w = img.shape[:2]
    # Plate region: center, bumper area. For rear exterior, plate ~72-76% from top.
    # EU plate ~5:1 aspect. ~20% width, ~5% height
    plate_w = max(70, int(w * 0.20))
    plate_h = max(22, int(h * 0.05))
    plate_w = min(plate_w, w - 32)
    plate_h = min(plate_h, h // 5)
    px = (w - plate_w) // 2
    py = int(h * 0.73) - plate_h // 2
    py = max(int(h * 0.58), min(py, h - plate_h - 20))
    px = max(8, min(px, w - plate_w - 8))
    # Create mask for plate region and inpaint to clean (remove text/numbers)
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[py : py + plate_h, px : px + plate_w] = 255
    img = cv2.inpaint(img, mask, inpaintRadius=7, flags=cv2.INPAINT_TELEA)
    # Fill plate with clean white (EU style) for consistent base
    img[py : py + plate_h, px : px + plate_w] = (240, 240, 240)
    # Resize logo to fit plate (leave small margin)
    margin = max(2, min(plate_w, plate_h) // 8)
    logo_max_w = plate_w - 2 * margin
    logo_max_h = plate_h - 2 * margin
    lh, lw = logo.shape[:2]
    scale = min(logo_max_w / max(lw, 1), logo_max_h / max(lh, 1), 1.0)
    new_lw = max(16, int(lw * scale))
    new_lh = max(8, int(lh * scale))
    logo_resized = cv2.resize(logo, (new_lw, new_lh), interpolation=cv2.INTER_AREA)
    lx = px + (plate_w - new_lw) // 2
    ly = py + (plate_h - new_lh) // 2
    if len(logo_resized.shape) == 3 and logo_resized.shape[2] == 4:
        alpha = logo_resized[:, :, 3:4] / 255.0
        logo_rgb = logo_resized[:, :, :3]
        roi = img[ly : ly + new_lh, lx : lx + new_lw]
        blended = (alpha * logo_rgb + (1 - alpha) * roi).astype(np.uint8)
        img[ly : ly + new_lh, lx : lx + new_lw] = blended
    else:
        logo_rgb = logo_resized[:, :, :3] if len(logo_resized.shape) == 3 else cv2.cvtColor(logo_resized, cv2.COLOR_GRAY2BGR)
        img[ly : ly + new_lh, lx : lx + new_lw] = logo_rgb
    _, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf.tobytes()).decode()


def overlay_logo_wall(
    image_b64: str,
    logo_b64: str,
    size_ratio: float = 0.15,
    opacity: float = 0.75,
) -> str:
    """
    Overlay logo on the studio wall (top center) with 3D perspective effect.
    Applies perspective warp so the logo appears to sit on the receding wall surface.
    Returns base64 JPEG.
    """
    img, logo_resized = _decode_and_resize_logo(
        image_b64, logo_b64,
        target_size=max(80, min(int(350 * size_ratio), 220)),
    )
    if img is None or logo_resized is None:
        return image_b64
    h, w = img.shape[:2]
    lh, lw = logo_resized.shape[:2]
    x_center = w // 2
    y = max(12, int(h * 0.06))

    # 3D perspective: trapezoid with top narrower (logo receding into wall)
    # Source rectangle corners
    pts_src = np.float32([[0, 0], [lw, 0], [0, lh], [lw, lh]])
    # Destination trapezoid: top edge 20% narrower to simulate depth on wall
    taper = 0.20
    pts_dst = np.float32([
        [lw * taper, 0],
        [lw * (1 - taper), 0],
        [0, lh],
        [lw, lh],
    ])
    M = cv2.getPerspectiveTransform(pts_src, pts_dst)
    logo_warped = cv2.warpPerspective(logo_resized, M, (lw, lh), flags=cv2.INTER_LINEAR)

    # Blend with alpha
    if len(logo_warped.shape) == 3 and logo_warped.shape[2] == 4:
        alpha = (logo_warped[:, :, 3:4] / 255.0) * opacity
    else:
        alpha = np.ones((lh, lw, 1), dtype=np.float32) * opacity
    logo_rgb = logo_warped[:, :, :3] if len(logo_warped.shape) == 3 else cv2.cvtColor(logo_warped, cv2.COLOR_GRAY2BGR)
    x = x_center - lw // 2
    x = max(8, min(x, w - lw - 8))
    y = min(y, h - lh - 8)
    if y < 0 or x < 0 or y + lh > h or x + lw > w:
        return image_b64
    roi = img[y : y + lh, x : x + lw]
    blended = (alpha * logo_rgb + (1 - alpha) * roi).astype(np.uint8)
    img[y : y + lh, x : x + lw] = blended
    _, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf.tobytes()).decode()
