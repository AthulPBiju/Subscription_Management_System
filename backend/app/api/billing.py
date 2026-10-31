from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..security import require_roles
from ..services.billing import generate_due_invoices
from ..core.utils import serialize

router = APIRouter()


@router.post("/run")
def run_billing(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    """Generate invoices for all Active subscriptions whose billing date is today or in the past."""
    created = generate_due_invoices(db, date.today())
    return {
        "created": len(created),
        "invoices": [serialize(x) for x in created],
    }

