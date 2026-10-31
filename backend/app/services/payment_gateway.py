import hashlib
import hmac
import uuid
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..models import Invoice, Payment
from ..core.config import settings


def create_gateway_order(
    db: Session,
    invoice: Invoice,
    gateway: str,
) -> dict:
    """Create a gateway checkout session/order for either Razorpay or Stripe."""
    gateway = gateway.lower()
    order_ref = f"{gateway[:3].upper()}_{uuid.uuid4().hex[:12]}"

    if gateway == "razorpay":
        # Razorpay amounts are in paise (x100)
        return {
            "gateway": "razorpay",
            "order_id": f"order_{order_ref}",
            "amount": int(invoice.total * 100),
            "currency": "INR",
            "key_id": "rzp_test_brightloop_demo",
            "invoice_number": invoice.number,
            "customer_name": invoice.customer.name,
            "customer_email": invoice.customer.email,
        }
    elif gateway == "stripe":
        return {
            "gateway": "stripe",
            "session_id": f"cs_test_{order_ref}",
            "amount": int(invoice.total * 100),
            "currency": "inr",
            "publishable_key": "pk_test_brightloop_demo",
            "invoice_number": invoice.number,
            "customer_email": invoice.customer.email,
        }
    else:
        raise ValueError(f"Unsupported gateway '{gateway}'. Supported: razorpay, stripe")


def process_webhook_event(
    db: Session,
    gateway: str,
    event_type: str,
    payload: dict,
    signature: str | None = None,
) -> dict:
    """Idempotent webhook event processor for Razorpay and Stripe."""
    gateway = gateway.lower()

    invoice_id = payload.get("invoice_id")
    transaction_id = payload.get("transaction_id") or f"txn_{uuid.uuid4().hex[:10]}"
    amount = float(payload.get("amount", 0.0))

    if not invoice_id:
        return {"status": "ignored", "reason": "No invoice_id in webhook payload"}

    # Idempotency check: see if this transaction was already processed
    existing = db.scalar(select(Payment).where(Payment.transaction_id == transaction_id))
    if existing:
        return {"status": "duplicate", "detail": f"Transaction {transaction_id} already recorded."}

    inv = db.get(Invoice, invoice_id)
    if not inv:
        return {"status": "error", "reason": f"Invoice {invoice_id} not found."}

    # Record successful payment
    payment = Payment(
        invoice_id=inv.id,
        method=gateway.capitalize(),
        amount=amount or inv.total,
        paid_on=date.today(),
        status="Succeeded",
        transaction_id=transaction_id,
        gateway=gateway.capitalize(),
        note=f"Automated webhook capture for {event_type}",
    )
    db.add(payment)
    inv.status = "Paid"
    db.commit()
    db.refresh(payment)

    return {
        "status": "success",
        "payment_id": payment.id,
        "invoice_status": inv.status,
        "transaction_id": transaction_id,
    }

