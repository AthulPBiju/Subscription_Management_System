from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from ..database import get_db
from ..models import User, Subscription, Invoice, Payment, Customer
from ..security import require_roles

router = APIRouter()


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    today = date.today()

    total_revenue = float(
        db.scalar(select(func.coalesce(func.sum(Payment.amount), 0))) or 0
    )
    outstanding = float(
        db.scalar(
            select(func.coalesce(func.sum(Invoice.total), 0)).where(
                Invoice.status.not_in(["Paid", "Cancelled"])
            )
        )
        or 0
    )
    active_subs = (
        db.scalar(
            select(func.count()).select_from(Subscription).where(Subscription.status == "Active")
        )
        or 0
    )
    overdue_invoices = (
        db.scalar(
            select(func.count())
            .select_from(Invoice)
            .where(Invoice.status.not_in(["Paid", "Cancelled"]), Invoice.due_date < today)
        )
        or 0
    )
    paid_invoices = (
        db.scalar(select(func.count()).select_from(Invoice).where(Invoice.status == "Paid")) or 0
    )
    total_customers = (
        db.scalar(select(func.count()).select_from(Customer)) or 0
    )

    return {
        "active_subscriptions": active_subs,
        "revenue_received": round(total_revenue, 2),
        "outstanding": round(outstanding, 2),
        "overdue_invoices": overdue_invoices,
        "paid_invoices": paid_invoices,
        "total_customers": total_customers,
    }

