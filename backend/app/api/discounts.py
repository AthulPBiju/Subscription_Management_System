from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, Discount
from ..schemas import DiscountIn, DiscountUpdate
from ..security import require_roles
from ..core.utils import serialize

router = APIRouter()

VALID_KINDS = ("percentage", "fixed")


@router.get("")
def list_discounts(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    return [
        serialize(x)
        for x in db.scalars(select(Discount).order_by(Discount.id.desc()).offset(skip).limit(limit)).all()
    ]


@router.get("/{discount_id}")
def get_discount(
    discount_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    d = db.get(Discount, discount_id)
    if not d:
        raise HTTPException(404, "Discount not found.")
    return serialize(d)


@router.post("")
def create_discount(
    payload: DiscountIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    if payload.kind not in VALID_KINDS:
        raise HTTPException(422, "Kind must be 'percentage' or 'fixed'.")
    if payload.kind == "percentage" and payload.value > 100:
        raise HTTPException(422, "Percentage discount cannot exceed 100%.")
    d = Discount(**payload.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return serialize(d)


@router.patch("/{discount_id}")
def update_discount(
    discount_id: int,
    payload: DiscountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    d = db.get(Discount, discount_id)
    if not d:
        raise HTTPException(404, "Discount not found.")
    updates = payload.model_dump(exclude_none=True)
    effective_kind = updates.get("kind", d.kind)
    if "kind" in updates and updates["kind"] not in VALID_KINDS:
        raise HTTPException(422, "Kind must be 'percentage' or 'fixed'.")
    if "value" in updates and effective_kind == "percentage" and updates["value"] > 100:
        raise HTTPException(422, "Percentage discount cannot exceed 100%.")
    for field, val in updates.items():
        setattr(d, field, val)
    db.commit()
    db.refresh(d)
    return serialize(d)


@router.delete("/{discount_id}")
def delete_discount(
    discount_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    d = db.get(Discount, discount_id)
    if not d:
        raise HTTPException(404, "Discount not found.")
    d.active = False
    db.commit()
    return {"detail": "Discount deactivated successfully."}

