"""
Audit log API — immutable append-only record of all significant system events.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, AuditLog
from ..security import require_roles
from ..core.utils import serialize

router = APIRouter()


@router.get("")
def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    entity_type: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    """Return recent audit log entries. Admin only."""
    q = select(AuditLog).order_by(AuditLog.id.desc()).offset(skip).limit(limit)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    return [serialize(x) for x in db.scalars(q).all()]
