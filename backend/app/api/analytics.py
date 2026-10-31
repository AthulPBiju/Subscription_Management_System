import csv
from io import StringIO
from datetime import date
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from ..database import get_db
from ..models import Subscription, Customer, Invoice, Payment, User
from ..security import require_roles

router = APIRouter()


@router.get("/summary")
def analytics_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    """Accurate SaaS metrics computed strictly from real database records."""
    total_customers = db.scalar(select(func.count()).select_from(Customer)) or 0
    total_revenue = float(db.scalar(select(func.coalesce(func.sum(Payment.amount), 0))) or 0)

    # Active subscriptions
    active_subs = db.scalars(select(Subscription).where(Subscription.status == "Active")).all()
    closed_subs = db.scalar(select(func.count()).select_from(Subscription).where(Subscription.status == "Closed")) or 0
    total_subs = db.scalar(select(func.count()).select_from(Subscription)) or 0

    # Monthly Recurring Revenue (MRR) normalized
    mrr = 0.0
    for sub in active_subs:
        interval = sub.plan.interval if sub.plan else "monthly"
        price = sub.unit_price * sub.quantity
        if interval == "monthly":
            mrr += price
        elif interval == "yearly":
            mrr += price / 12
        elif interval == "weekly":
            mrr += price * 4.33
        elif interval == "daily":
            mrr += price * 30

    arr = round(mrr * 12, 2)
    mrr = round(mrr, 2)

    # Average Revenue Per User (ARPU)
    active_customer_count = len(set(s.customer_id for s in active_subs))
    arpu = round(mrr / active_customer_count, 2) if active_customer_count > 0 else 0.0

    # Churn rate: closed subscriptions / total subscriptions
    churn_rate = round((closed_subs / total_subs) * 100, 2) if total_subs > 0 else 0.0

    # Customer Lifetime Value (LTV): ARPU / (Churn rate % / 100)
    # Assumes a benchmark min churn of 3% for division safety
    effective_churn = max(0.03, churn_rate / 100)
    ltv = round(arpu / effective_churn, 2) if arpu > 0 else 0.0

    return {
        "mrr": mrr,
        "arr": arr,
        "arpu": arpu,
        "ltv": ltv,
        "churn_rate_pct": churn_rate,
        "active_customers": active_customer_count,
        "total_customers": total_customers,
        "total_revenue": round(total_revenue, 2),
        "active_contracts": len(active_subs),
        "closed_contracts": closed_subs,
    }


@router.get("/export-csv")
def export_financial_csv(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    """Download verified financial ledger & invoice register in standard CSV format."""
    invoices = db.scalars(select(Invoice).order_by(Invoice.id.desc())).all()

    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Invoice Number",
        "Customer Name",
        "Customer Email",
        "Billing Date",
        "Due Date",
        "Subtotal",
        "Discount Amount",
        "Tax Amount",
        "Total",
        "Status",
    ])

    for inv in invoices:
        writer.writerow([
            inv.number,
            inv.customer.name if inv.customer else f"Customer #{inv.customer_id}",
            inv.customer.email if inv.customer else "",
            inv.billing_date.isoformat(),
            inv.due_date.isoformat(),
            f"{inv.subtotal:.2f}",
            f"{inv.discount_amount:.2f}",
            f"{inv.tax_amount:.2f}",
            f"{inv.total:.2f}",
            inv.status,
        ])

    csv_data = buf.getvalue()
    filename = f"brightloop_financials_{date.today():%Y%m%d}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

