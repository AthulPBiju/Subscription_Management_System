from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from ..database import get_db
from ..models import User, Payment, Invoice
from ..schemas import PaymentIn
from ..security import require_roles
from ..core.utils import serialize

router = APIRouter()


@router.get("")
def list_payments(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    return [
        serialize(x)
        for x in db.scalars(select(Payment).order_by(Payment.id.desc()).offset(skip).limit(limit)).all()
    ]


@router.post("")
def record_payment(
    payload: PaymentIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    inv = db.get(Invoice, payload.invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    if inv.status == "Cancelled":
        raise HTTPException(400, "Cannot record a payment against a cancelled invoice.")

    already_paid = (
        db.scalar(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.invoice_id == inv.id)
        )
        or 0
    )
    balance = round(float(inv.total) - float(already_paid), 2)

    if payload.amount > balance + 0.001:
        raise HTTPException(
            400,
            f"Payment amount ({payload.amount:,.2f}) exceeds the remaining balance ({balance:,.2f}).",
        )

    p = Payment(**payload.model_dump())
    db.add(p)

    # Auto-mark invoice as Paid when balance is cleared
    if payload.amount >= balance - 0.001:
        inv.status = "Paid"
    else:
        inv.status = "Confirmed"

    db.commit()
    db.refresh(p)
    return serialize(p)

