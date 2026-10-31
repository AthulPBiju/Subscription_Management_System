from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import Notification, User
from ..security import current_user
from ..core.utils import serialize

router = APIRouter()


@router.get("")
def list_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Retrieve notifications for the current user and system broadcasts."""
    query = (
        select(Notification)
        .where((Notification.user_id == user.id) | (Notification.user_id == None))
        .order_by(Notification.id.desc())
        .limit(limit)
    )
    return [serialize(n) for n in db.scalars(query).all()]


@router.patch("/{nid}/read")
def mark_read(
    nid: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    notif = db.get(Notification, nid)
    if not notif:
        raise HTTPException(404, "Notification not found.")
    notif.is_read = True
    db.commit()
    return {"status": "ok"}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    notifs = db.scalars(
        select(Notification).where(
            (Notification.user_id == user.id) | (Notification.user_id == None),
            Notification.is_read == False,
        )
    ).all()
    for n in notifs:
        n.is_read = True
    db.commit()
    return {"marked": len(notifs)}

