"""Dealer API - CRUD, preferences, assets."""

import base64
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Dealer, DealerPreferences, DealerAsset
from app.schemas import (
    DealerCreate,
    DealerUpdate,
    DealerResponse,
    DealerPreferencesUpdate,
    DealerPreferencesResponse,
    DealerAssetResponse,
)

router = APIRouter(prefix="/api/v1/dealers", tags=["dealers"])


def _dealer_to_response(d: Dealer, include_prefs: bool = True, include_assets: bool = True) -> dict:
    """Convert Dealer model to response dict."""
    prefs = None
    if include_prefs and d.preferences:
        p = d.preferences
        prefs = DealerPreferencesResponse(
            logo_corner_enabled=p.logo_corner_enabled,
            logo_corner_position=p.logo_corner_position or "right",
            license_plate_enabled=p.license_plate_enabled,
            logo_3d_wall_enabled=p.logo_3d_wall_enabled,
            default_studio_id=p.default_studio_id,
        )
    assets_list = []
    if include_assets and d.assets:
        for a in d.assets:
            assets_list.append(
                DealerAssetResponse(
                    id=a.id,
                    asset_type=a.asset_type,
                    file_path=a.file_path,
                    data_b64=a.data_b64,
                    created_at=a.created_at.isoformat() if a.created_at else "",
                )
            )
    return {
        "id": d.id,
        "name": d.name,
        "email": d.email,
        "created_at": d.created_at.isoformat() if d.created_at else "",
        "updated_at": d.updated_at.isoformat() if d.updated_at else "",
        "preferences": prefs,
        "assets": assets_list,
    }


@router.get("", response_model=list[dict])
def list_dealers(
    email: str | None = Query(None, description="Filter by email"),
    db: Session = Depends(get_db),
):
    """List dealers, optionally filtered by email."""
    q = db.query(Dealer)
    if email:
        q = q.filter(Dealer.email.ilike(f"%{email}%"))
    dealers = q.order_by(Dealer.created_at.desc()).all()
    return [_dealer_to_response(d, include_prefs=False, include_assets=False) for d in dealers]


@router.post("", response_model=dict)
def create_dealer(body: DealerCreate, db: Session = Depends(get_db)):
    """Create a new dealer."""
    existing = db.query(Dealer).filter(Dealer.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Dealer with this email already exists")
    dealer = Dealer(name=body.name, email=body.email)
    db.add(dealer)
    db.commit()
    db.refresh(dealer)
    return _dealer_to_response(dealer, include_prefs=False, include_assets=False)


@router.get("/{dealer_id}", response_model=dict)
def get_dealer(dealer_id: int, db: Session = Depends(get_db)):
    """Get dealer with preferences and assets."""
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return _dealer_to_response(dealer)


@router.patch("/{dealer_id}", response_model=dict)
def update_dealer(dealer_id: int, body: DealerUpdate, db: Session = Depends(get_db)):
    """Update dealer."""
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    if body.name is not None:
        dealer.name = body.name
    if body.email is not None:
        existing = db.query(Dealer).filter(Dealer.email == body.email, Dealer.id != dealer_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another dealer with this email exists")
        dealer.email = body.email
    dealer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dealer)
    return _dealer_to_response(dealer)


@router.post("/{dealer_id}/preferences", response_model=dict)
def upsert_preferences(
    dealer_id: int,
    body: DealerPreferencesUpdate,
    db: Session = Depends(get_db),
):
    """Create or update dealer preferences."""
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    prefs = dealer.preferences
    if not prefs:
        prefs = DealerPreferences(dealer_id=dealer_id)
        db.add(prefs)
        db.flush()
    if body.logo_corner_enabled is not None:
        prefs.logo_corner_enabled = body.logo_corner_enabled
    if body.logo_corner_position is not None:
        prefs.logo_corner_position = body.logo_corner_position
    if body.license_plate_enabled is not None:
        prefs.license_plate_enabled = body.license_plate_enabled
    if body.logo_3d_wall_enabled is not None:
        prefs.logo_3d_wall_enabled = body.logo_3d_wall_enabled
    if body.default_studio_id is not None:
        prefs.default_studio_id = body.default_studio_id
    prefs.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dealer)
    return _dealer_to_response(dealer)


@router.post("/{dealer_id}/assets", response_model=dict)
async def upload_asset(
    dealer_id: int,
    asset_type: str = Form(..., description="logo, studio, or license_plate"),
    file: UploadFile | None = File(None),
    data_b64: str | None = Form(None, description="Base64 image data (alternative to file upload)"),
    db: Session = Depends(get_db),
):
    """Upload logo, studio, or license_plate asset. Use multipart file or base64 in form."""
    if asset_type not in ("logo", "studio", "license_plate"):
        raise HTTPException(status_code=400, detail="asset_type must be logo, studio, or license_plate")
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")

    b64_content = None
    if file:
        content = await file.read()
        b64_content = base64.b64encode(content).decode()
    elif data_b64:
        # Strip data URL prefix if present
        if "," in data_b64:
            b64_content = data_b64.split(",", 1)[1]
        else:
            b64_content = data_b64

    if not b64_content:
        raise HTTPException(status_code=400, detail="Provide either file upload or data_b64")

    asset = DealerAsset(
        dealer_id=dealer_id,
        asset_type=asset_type,
        data_b64=b64_content,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return {
        "id": asset.id,
        "asset_type": asset.asset_type,
        "file_path": asset.file_path,
        "data_b64": asset.data_b64[:100] + "..." if asset.data_b64 and len(asset.data_b64) > 100 else asset.data_b64,
        "created_at": asset.created_at.isoformat() if asset.created_at else "",
    }


@router.get("/{dealer_id}/assets", response_model=list[dict])
def list_assets(dealer_id: int, db: Session = Depends(get_db)):
    """List dealer assets."""
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    assets = db.query(DealerAsset).filter(DealerAsset.dealer_id == dealer_id).order_by(DealerAsset.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "asset_type": a.asset_type,
            "file_path": a.file_path,
            "data_b64": a.data_b64[:80] + "..." if a.data_b64 and len(a.data_b64) > 80 else a.data_b64,
            "created_at": a.created_at.isoformat() if a.created_at else "",
        }
        for a in assets
    ]


@router.delete("/{dealer_id}/assets/{asset_id}")
def delete_asset(
    dealer_id: int,
    asset_id: int,
    db: Session = Depends(get_db),
):
    """Delete a dealer asset (logo, studio, license_plate)."""
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    asset = db.query(DealerAsset).filter(
        DealerAsset.id == asset_id,
        DealerAsset.dealer_id == dealer_id,
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(asset)
    db.commit()
    return {"deleted": True, "asset_id": asset_id}


@router.get("/{dealer_id}/assets/studio")
def get_studio_asset(dealer_id: int, db: Session = Depends(get_db)):
    """Get dealer's studio asset as full base64 data URI for use in processing."""
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    asset = (
        db.query(DealerAsset)
        .filter(DealerAsset.dealer_id == dealer_id, DealerAsset.asset_type == "studio")
        .order_by(DealerAsset.created_at.desc())
        .first()
    )
    if not asset or not asset.data_b64:
        raise HTTPException(status_code=404, detail="No studio asset found")
    b64 = asset.data_b64
    if "," not in b64:
        b64 = f"data:image/jpeg;base64,{b64}"
    return {"data_uri": b64}
