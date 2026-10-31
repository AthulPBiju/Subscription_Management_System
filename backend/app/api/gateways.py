from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invoice
from ..schemas import CheckoutSessionIn, WebhookEventIn
from ..security import current_user
from ..services.payment_gateway import create_gateway_order, process_webhook_event

router = APIRouter()


@router.post("/checkout")
def create_checkout(
    payload: CheckoutSessionIn,
    db: Session = Depends(get_db),
    user = Depends(current_user),
):
    """Generate a payment order or checkout session for Stripe / Razorpay."""
    inv = db.get(Invoice, payload.invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    if inv.status == "Paid":
        raise HTTPException(400, "This invoice is already fully settled.")
    if inv.status == "Cancelled":
        raise HTTPException(400, "Cannot pay a cancelled invoice.")

    order = create_gateway_order(db, inv, payload.gateway)
    return order


@router.post("/webhook")
def receive_webhook(
    payload: WebhookEventIn,
    db: Session = Depends(get_db),
    x_signature: str | None = Header(None, alias="X-Signature"),
):
    """Receive and process gateway webhook events idempotently."""
    sig = payload.signature or x_signature
    result = process_webhook_event(
        db,
        gateway=payload.gateway,
        event_type=payload.event,
        payload=payload.payload,
        signature=sig,
    )
    return result

