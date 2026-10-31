"""
Business settings API — read and persist workspace-level configuration.
Settings are stored as key-value pairs in the business_settings table.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from ..models import User, BusinessSetting
from ..schemas import BusinessSettingIn
from ..security import current_user, require_roles

router = APIRouter()

_DEFAULT_SETTINGS = {
    "company_name": "Brightloop Software",
    "support_email": "support@brightloop.com",
    "currency": "INR",
    "tax_id": "",
    "invoice_prefix": "INV",
    "address": "",
    "logo_url": "",
    "website": "",
}


def _load(db: Session) -> dict:
    rows = db.scalars(select(BusinessSetting)).all()
    data = dict(_DEFAULT_SETTINGS)
    for row in rows:
        data[row.key] = row.value
    return data


def _save(db: Session, key: str, value: str) -> None:
    existing = db.get(BusinessSetting, key)
    if existing:
        existing.value = value
    else:
        db.add(BusinessSetting(key=key, value=value))


@router.get("")
def get_settings(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Return current business settings (readable by all authenticated users)."""
    return _load(db)


@router.patch("")
def update_settings(
    payload: BusinessSettingIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    """Update business workspace settings (admin only)."""
    for field, value in payload.model_dump().items():
        _save(db, field, str(value))
    db.commit()
    return _load(db)
