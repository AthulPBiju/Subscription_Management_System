from datetime import date, timedelta
from calendar import monthrange
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import Subscription, Invoice, Discount, Notification


def add_interval(day: date, interval: str) -> date:
    if interval == "daily":
        return day + timedelta(days=1)
    if interval == "weekly":
        return day + timedelta(days=7)
    if interval == "monthly":
        month = day.month % 12 + 1
        year = day.year + (1 if day.month == 12 else 0)
        return date(year, month, min(day.day, monthrange(year, month)[1]))
    if interval == "yearly":
        try:
            return day.replace(year=day.year + 1)
        except ValueError:
            return day.replace(year=day.year + 1, day=28)
    raise ValueError("Unsupported billing interval")


def discount_value(db: Session, sub: Subscription, subtotal: float, today: date):
    rule = sub.discount
    if not rule or not rule.active:
        return 0.0
    if rule.starts_on and today < rule.starts_on:
        return 0.0
    if rule.ends_on and today > rule.ends_on:
        return 0.0
    if sub.quantity < rule.min_quantity:
        return 0.0
    if rule.usage_limit is not None and rule.used_count >= rule.usage_limit:
        return 0.0
    amount = subtotal * rule.value / 100 if rule.kind == "percentage" else rule.value
    return round(min(amount, subtotal), 2)


def generate_due_invoices(db: Session, today: date):
    created = []
    subs = db.scalars(select(Subscription).where(
        Subscription.status == "Active",
        Subscription.next_billing_date <= today
    )).all()
    for sub in subs:
        # Enforce cancel_at_period_end — close before generating invoice
        if sub.cancel_at_period_end:
            sub.status = "Closed"
            from datetime import datetime
            sub.cancelled_at = datetime.utcnow()
            _notify(
                db,
                f"Subscription {sub.number} closed at period end.",
                "Subscription auto-closed per cancellation schedule.",
                "warning"
            )
            continue

        cycle_date = sub.next_billing_date
        exists = db.scalar(select(Invoice).where(
            Invoice.subscription_id == sub.id, Invoice.billing_date == cycle_date
        ))
        if exists:
            sub.next_billing_date = add_interval(cycle_date, sub.plan.interval)
            continue

        subtotal = round(sub.unit_price * sub.quantity, 2)
        discount = discount_value(db, sub, subtotal, today)
        taxable = max(0, subtotal - discount)
        tax = round(taxable * sub.tax_rate / 100, 2)
        total = round(taxable + tax, 2)

        unique_suffix = uuid.uuid4().hex[:6].upper()
        invoice = Invoice(
            number=f"INV-{today:%Y%m}-{sub.id:05d}-{unique_suffix}",
            subscription_id=sub.id,
            customer_id=sub.customer_id,
            billing_date=cycle_date,
            due_date=cycle_date + timedelta(days=7),
            subtotal=subtotal,
            discount_amount=discount,
            tax_amount=tax,
            total=total,
            status="Confirmed"
        )
        db.add(invoice)
        if discount and sub.discount:
            sub.discount.used_count += 1
        sub.next_billing_date = add_interval(cycle_date, sub.plan.interval)
        if sub.expiry_date and sub.next_billing_date > sub.expiry_date and sub.plan.auto_close:
            sub.status = "Closed"
        created.append(invoice)

        # Renewal reminder notification if next billing is within 7 days
        days_to_next = (sub.next_billing_date - today).days
        if 0 < days_to_next <= 7:
            _notify(
                db,
                f"Renewal reminder: {sub.number}",
                f"Subscription {sub.number} renews in {days_to_next} day(s) on {sub.next_billing_date}.",
                "info",
            )

    db.commit()
    return created


def _notify(db: Session, title: str, message: str, kind: str = "info"):
    from ..models import Notification
    n = Notification(title=title, message=message, kind=kind)
    db.add(n)
