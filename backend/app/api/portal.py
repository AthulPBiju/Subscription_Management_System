from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, Customer, Subscription, Invoice, Payment, Plan
from ..security import current_user
from ..core.utils import serialize
from .subscriptions import sub_dict
from .invoices import inv_dict

router = APIRouter()


def get_current_customer(user: User, db: Session) -> Customer:
    c = db.scalar(select(Customer).where(Customer.user_id == user.id))
    if not c:
        # Check by email fallback
        c = db.scalar(select(Customer).where(Customer.email == user.email))
    if not c:
        raise HTTPException(404, "No customer profile linked to your user account.")
    return c


@router.get("/me")
def customer_profile(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Retrieve customer's own profile and account statistics."""
    c = get_current_customer(user, db)
    data = serialize(c)
    subs = db.scalars(select(Subscription).where(Subscription.customer_id == c.id)).all()
    invoices = db.scalars(select(Invoice).where(Invoice.customer_id == c.id)).all()

    data["active_subscriptions"] = sum(1 for s in subs if s.status == "Active")
    data["total_invoices"] = len(invoices)
    data["unpaid_invoices"] = sum(1 for i in invoices if i.status not in ("Paid", "Cancelled"))
    return data


@router.get("/subscriptions")
def customer_subscriptions(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """List customer's own active and historical subscriptions."""
    c = get_current_customer(user, db)
    rows = db.scalars(
        select(Subscription)
        .where(Subscription.customer_id == c.id)
        .order_by(Subscription.id.desc())
    ).all()
    return [sub_dict(s) for s in rows]


@router.get("/invoices")
def customer_invoices(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """List customer's own invoices."""
    c = get_current_customer(user, db)
    rows = db.scalars(
        select(Invoice)
        .where(Invoice.customer_id == c.id)
        .order_by(Invoice.id.desc())
    ).all()
    return [inv_dict(i) for i in rows]


@router.get("/available-plans")
def customer_available_plans(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """List active plans that customer can upgrade or switch to."""
    plans = db.scalars(select(Plan).where(Plan.active == True).order_by(Plan.price.asc())).all()
    return [serialize(p) for p in plans]

