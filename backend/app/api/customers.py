from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from ..database import get_db
from ..models import User, Customer, Subscription
from ..schemas import CustomerIn, CustomerUpdate
from ..security import require_roles
from ..core.utils import serialize

router = APIRouter()


@router.get("")
def list_customers(
    skip: int = 0,
    limit: int = 200,
    q: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    query = select(Customer).order_by(Customer.id.desc()).offset(skip).limit(limit)
    if q:
        like = f"%{q}%"
        query = query.where(
            Customer.name.ilike(like)
            | Customer.email.ilike(like)
            | Customer.company.ilike(like)
        )
    return [serialize(x) for x in db.scalars(query).all()]


@router.get("/{customer_id}")
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found.")
    result = serialize(c)
    result["subscription_count"] = (
        db.scalar(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.customer_id == customer_id)
        )
        or 0
    )
    result["active_subscription_count"] = (
        db.scalar(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.customer_id == customer_id, Subscription.status == "Active")
        )
        or 0
    )
    return result


@router.post("")
def create_customer(
    payload: CustomerIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    if db.scalar(select(Customer).where(Customer.email == payload.email)):
        raise HTTPException(409, "A customer with this email already exists.")
    c = Customer(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.patch("/{customer_id}")
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found.")
    updates = payload.model_dump(exclude_none=True)
    if "email" in updates:
        conflict = db.scalar(
            select(Customer).where(Customer.email == updates["email"], Customer.id != customer_id)
        )
        if conflict:
            raise HTTPException(409, "Email is already in use by another customer.")
    for field, val in updates.items():
        setattr(c, field, val)
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found.")
    active_count = (
        db.scalar(
            select(func.count())
            .select_from(Subscription)
            .where(
                Subscription.customer_id == customer_id,
                Subscription.status.in_(["Active", "Paused"]),
            )
        )
        or 0
    )
    if active_count > 0:
        raise HTTPException(
            400,
            f"Cannot delete this customer — they have {active_count} active subscription(s). "
            "Close those subscriptions first.",
        )
    db.delete(c)
    db.commit()
    return {"detail": "Customer deleted."}

