from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from ..database import get_db
from ..models import (
    User, Customer, Subscription, Plan, Product, Discount,
    SubscriptionHistory, Invoice,
)
from ..schemas import SubscriptionIn, StatusIn, ChangePlanIn, CancelSubscriptionIn
from ..security import current_user, require_roles
from ..core.utils import serialize
from ..services.proration import calculate_proration
from ..services.notifications import create_notification

router = APIRouter()

TRANSITIONS: dict[str, list[str]] = {
    "Draft":     ["Quotation", "Confirmed", "Closed"],
    "Quotation": ["Confirmed", "Closed"],
    "Confirmed": ["Active", "Closed"],
    "Active":    ["Paused", "Closed"],
    "Paused":    ["Active", "Closed"],
    "Closed":    [],
}


def sub_dict(sub: Subscription) -> dict:
    d = serialize(sub)
    d["customer_name"]  = sub.customer.name if sub.customer else ""
    d["customer_email"] = sub.customer.email if sub.customer else ""
    d["plan_name"]      = sub.plan.name if sub.plan else ""
    d["plan_interval"]  = sub.plan.interval if sub.plan else ""
    d["product_name"]   = sub.product.name if sub.product else ""
    d["discount_name"]  = sub.discount.name if sub.discount else None
    return d


@router.get("")
def list_subscriptions(
    skip: int = 0,
    limit: int = 200,
    status: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    q = select(Subscription).order_by(Subscription.id.desc()).offset(skip).limit(limit)
    if user.role == "customer":
        c = db.scalar(select(Customer).where(Customer.user_id == user.id))
        if not c:
            return []
        q = q.where(Subscription.customer_id == c.id)
    if status:
        q = q.where(Subscription.status == status)
    return [sub_dict(s) for s in db.scalars(q).all()]


@router.get("/{sub_id}")
def get_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    sub = db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(404, "Subscription not found.")
    if user.role == "customer":
        c = db.scalar(select(Customer).where(Customer.user_id == user.id))
        if not c or c.id != sub.customer_id:
            raise HTTPException(403, "You are not authorized to view this subscription.")
    return sub_dict(sub)


@router.post("")
def create_subscription(
    payload: SubscriptionIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found.")
    plan = db.get(Plan, payload.plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found.")
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(404, "Product not found.")
    if payload.quantity < plan.min_quantity:
        raise HTTPException(422, f"Minimum quantity for this plan is {plan.min_quantity}.")
    if payload.discount_id and not db.get(Discount, payload.discount_id):
        raise HTTPException(404, "Discount not found.")

    count = db.scalar(select(func.count()).select_from(Subscription)) or 0
    number = f"SUB-{date.today():%Y%m}-{count + 1:05d}"

    sub = Subscription(
        number=number,
        customer_id=customer.id,
        plan_id=plan.id,
        product_id=product.id,
        quantity=payload.quantity,
        unit_price=plan.price,
        tax_rate=payload.tax_rate,
        discount_id=payload.discount_id,
        status="Draft",
        start_date=payload.start_date,
        expiry_date=payload.expiry_date,
        payment_terms=payload.payment_terms,
        next_billing_date=payload.start_date,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    # Record history
    hist = SubscriptionHistory(
        subscription_id=sub.id,
        event="Created",
        new_plan_id=plan.id,
        notes=f"Created with {plan.name} plan in Draft status.",
    )
    db.add(hist)
    db.commit()

    return sub_dict(sub)


@router.patch("/{sub_id}/status")
def update_status(
    sub_id: int,
    payload: StatusIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    sub = db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(404, "Subscription not found.")

    allowed = TRANSITIONS.get(sub.status, [])
    if payload.status not in allowed:
        raise HTTPException(
            400,
            f"Cannot move from '{sub.status}' to '{payload.status}'. "
            f"Allowed next states: {allowed if allowed else 'none (terminal)'}",
        )
    if payload.status == "Paused" and not sub.plan.allow_pause:
        raise HTTPException(400, "Pausing is not allowed for this plan.")
    if (
        payload.status == "Closed"
        and sub.status in ("Active", "Paused")
        and not sub.plan.allow_early_close
    ):
        raise HTTPException(400, "Early closure is not allowed for this plan.")

    old_status = sub.status
    sub.status = payload.status
    if payload.status == "Paused":
        sub.paused_at = datetime.utcnow()
    elif payload.status == "Closed":
        sub.cancelled_at = datetime.utcnow()

    # Log history
    hist = SubscriptionHistory(
        subscription_id=sub.id,
        event=f"Status changed to {payload.status}",
        notes=f"Moved from {old_status} to {payload.status}.",
    )
    db.add(hist)

    # In-app notification
    create_notification(
        db,
        title=f"Subscription {sub.number} {payload.status}",
        message=f"Subscription moved to {payload.status}.",
        kind="info" if payload.status != "Closed" else "warning",
    )

    db.commit()
    return sub_dict(sub)


@router.post("/{sub_id}/change-plan")
def change_plan(
    sub_id: int,
    payload: ChangePlanIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Upgrade or downgrade plan with optional proration calculation."""
    sub = db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(404, "Subscription not found.")
    if sub.status != "Active":
        raise HTTPException(400, "Only active subscriptions can change plans.")

    new_plan = db.get(Plan, payload.new_plan_id)
    if not new_plan or not new_plan.active:
        raise HTTPException(404, "Target plan not found or inactive.")
    if new_plan.id == sub.plan_id:
        raise HTTPException(400, "Target plan is already the current plan.")

    today = date.today()
    proration = calculate_proration(sub, new_plan, today) if payload.prorate else None
    prorated_diff = proration["net_amount"] if proration else 0.0

    is_upgrade = new_plan.price > sub.unit_price
    event_name = "Upgraded" if is_upgrade else "Downgraded"

    old_plan_id = sub.plan_id
    sub.plan_id = new_plan.id
    sub.unit_price = new_plan.price

    # Generate immediate invoice if proration difference is positive
    prorated_invoice = None
    if prorated_diff > 0:
        inv_count = db.scalar(select(func.count()).select_from(Invoice)) or 0
        prorated_invoice = Invoice(
            number=f"INV-PRORATE-{date.today():%Y%m}-{inv_count + 1:04d}",
            subscription_id=sub.id,
            customer_id=sub.customer_id,
            billing_date=today,
            due_date=today,
            subtotal=prorated_diff,
            discount_amount=0.0,
            tax_amount=round(prorated_diff * sub.tax_rate / 100, 2),
            total=round(prorated_diff * (1 + sub.tax_rate / 100), 2),
            status="Confirmed",
        )
        db.add(prorated_invoice)

    # Record history
    hist = SubscriptionHistory(
        subscription_id=sub.id,
        event=event_name,
        old_plan_id=old_plan_id,
        new_plan_id=new_plan.id,
        prorated_amount=prorated_diff,
        notes=f"Changed plan to {new_plan.name}. {proration['summary'] if proration else 'No proration.'}",
    )
    db.add(hist)

    create_notification(
        db,
        title=f"Plan {event_name}: {sub.number}",
        message=f"Subscription changed to {new_plan.name}. {proration['summary'] if proration else ''}",
        kind="success" if is_upgrade else "info",
    )

    db.commit()
    result = sub_dict(sub)
    result["proration"] = proration
    if prorated_invoice:
        result["prorated_invoice_id"] = prorated_invoice.id
    return result


@router.post("/{sub_id}/cancel")
def cancel_subscription(
    sub_id: int,
    payload: CancelSubscriptionIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    sub = db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(404, "Subscription not found.")

    if payload.immediately:
        sub.status = "Closed"
        sub.cancelled_at = datetime.utcnow()
        event_name = "Cancelled (Immediate)"
    else:
        sub.cancel_at_period_end = True
        event_name = "Scheduled for cancellation at period end"

    hist = SubscriptionHistory(
        subscription_id=sub.id,
        event=event_name,
        notes=payload.reason,
    )
    db.add(hist)
    db.commit()
    return sub_dict(sub)


@router.get("/{sub_id}/history")
def get_subscription_history(
    sub_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    sub = db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(404, "Subscription not found.")
    records = db.scalars(
        select(SubscriptionHistory)
        .where(SubscriptionHistory.subscription_id == sub_id)
        .order_by(SubscriptionHistory.id.desc())
    ).all()
    return [serialize(h) for h in records]
