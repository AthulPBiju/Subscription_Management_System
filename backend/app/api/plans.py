from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, Plan
from ..schemas import PlanIn, PlanUpdate
from ..security import current_user, require_roles
from ..core.utils import serialize

router = APIRouter()

VALID_INTERVALS = ["daily", "weekly", "monthly", "yearly"]


@router.get("")
def list_plans(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return [
        serialize(x)
        for x in db.scalars(select(Plan).order_by(Plan.id.desc()).offset(skip).limit(limit)).all()
    ]


@router.get("/{plan_id}")
def get_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    p = db.get(Plan, plan_id)
    if not p:
        raise HTTPException(404, "Plan not found.")
    return serialize(p)


@router.post("")
def create_plan(
    payload: PlanIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    if payload.interval not in VALID_INTERVALS:
        raise HTTPException(422, f"Billing interval must be one of: {', '.join(VALID_INTERVALS)}")
    p = Plan(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.patch("/{plan_id}")
def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    p = db.get(Plan, plan_id)
    if not p:
        raise HTTPException(404, "Plan not found.")
    updates = payload.model_dump(exclude_none=True)
    if "interval" in updates and updates["interval"] not in VALID_INTERVALS:
        raise HTTPException(422, f"Billing interval must be one of: {', '.join(VALID_INTERVALS)}")
    for field, val in updates.items():
        setattr(p, field, val)
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.delete("/{plan_id}")
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    p = db.get(Plan, plan_id)
    if not p:
        raise HTTPException(404, "Plan not found.")
    p.active = False
    db.commit()
    return {"detail": "Plan deactivated successfully."}

