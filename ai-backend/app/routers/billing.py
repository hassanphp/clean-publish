"""Stripe billing - webhook and checkout session."""

import os

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

STRIPE_SECRET = os.getenv("STRIPE_SECRET_KEY") or os.getenv("STRIPE_API_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

if STRIPE_SECRET:
    stripe.api_key = STRIPE_SECRET

class CreateCheckoutRequest(BaseModel):
    """Create Stripe checkout session."""

    plan_id: str = Field(..., description="starter, growth, pro, addon_100, addon_300, addon_500")
    success_url: str = Field(default="http://localhost:3000/create?view=dashboard")
    cancel_url: str = Field(default="http://localhost:3000/pricing")


CREDITS_MAP: dict[str, int] = {
    "starter": 300,
    "growth": 1000,
    "pro": 3000,
    "addon_100": 100,
    "addon_300": 300,
    "addon_500": 500,
}


@router.post("/checkout")
def create_checkout(
    body: CreateCheckoutRequest,
    user: User = Depends(get_current_user),
):
    """Create Stripe checkout session. Pass user_email and user_id in metadata for webhook."""
    if not STRIPE_SECRET:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    if body.plan_id not in CREDITS_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan_id}")
    credits = CREDITS_MAP[body.plan_id]
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {"name": f"{body.plan_id.title()} - {credits} credits"},
                    "unit_amount": {"starter": 9900, "growth": 29900, "pro": 69900}.get(body.plan_id, 9900),
                },
                "quantity": 1,
            }],
            metadata={"user_id": str(user.id), "user_email": user.email, "plan_id": body.plan_id},
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    except stripe.error.StripeError as e:
        msg = getattr(e, "user_message", None) or str(e)
        raise HTTPException(status_code=400, detail=msg)
    return {"url": session.url, "session_id": session.id}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe webhook: checkout.session.completed.
    Increments User.credits by purchased amount. Metadata: user_email or user_id, plan_id.
    """
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET not configured")
    if not STRIPE_SECRET:
        raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY or STRIPE_API_KEY not configured")

    body = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not sig:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(body, sig, WEBHOOK_SECRET)
    except stripe.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] != "checkout.session.completed":
        return {"received": True}

    session = event["data"]["object"]
    metadata = session.get("metadata") or {}
    user_email = metadata.get("user_email")
    user_id = metadata.get("user_id")
    plan_id = metadata.get("plan_id", "")
    credits = CREDITS_MAP.get(plan_id, 0)

    if credits <= 0:
        return {"received": True, "skipped": "no plan_id or unknown plan"}

    user = None
    if user_id:
        try:
            uid = int(user_id)
            user = db.query(User).filter(User.id == uid).first()
        except (ValueError, TypeError):
            pass
    if not user and user_email:
        user = db.query(User).filter(User.email == user_email).first()

    if not user:
        return {"received": True, "skipped": "user not found"}

    user.credits = (user.credits or 0) + credits
    db.commit()
    return {"received": True, "credits": credits, "user_id": user.id}
