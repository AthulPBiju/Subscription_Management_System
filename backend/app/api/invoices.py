from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as rl_canvas

from ..database import get_db
from ..models import User, Invoice, Customer
from ..schemas import StatusIn
from ..security import current_user, require_roles
from ..core.utils import serialize

router = APIRouter()


def inv_dict(inv: Invoice) -> dict:
    """Serialize an invoice with resolved relationship names."""
    d = serialize(inv)
    d["customer_name"]        = inv.customer.name if inv.customer else ""
    d["subscription_number"]  = inv.subscription.number if inv.subscription else ""
    return d


@router.get("")
def list_invoices(
    skip: int = 0,
    limit: int = 200,
    status: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    q = select(Invoice).order_by(Invoice.id.desc()).offset(skip).limit(limit)
    if user.role == "customer":
        c = db.scalar(select(Customer).where(Customer.user_id == user.id))
        if not c:
            return []
        q = q.where(Invoice.customer_id == c.id)
    if status:
        q = q.where(Invoice.status == status)
    return [inv_dict(i) for i in db.scalars(q).all()]


@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    if user.role == "customer":
        c = db.scalar(select(Customer).where(Customer.user_id == user.id))
        if not c or c.id != inv.customer_id:
            raise HTTPException(403, "You are not authorized to view this invoice.")
    return inv_dict(inv)


@router.patch("/{invoice_id}/status")
def update_invoice_status(
    invoice_id: int,
    payload: StatusIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "staff")),
):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    if payload.status not in ("Draft", "Confirmed", "Cancelled"):
        raise HTTPException(422, "Valid statuses: Draft, Confirmed, Cancelled.")
    if inv.status == "Paid":
        raise HTTPException(400, "Paid invoices cannot be changed.")
    inv.status = payload.status
    db.commit()
    return inv_dict(inv)


@router.get("/{invoice_id}/pdf")
def download_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    if user.role == "customer":
        c = db.scalar(select(Customer).where(Customer.user_id == user.id))
        if not c or c.id != inv.customer_id:
            raise HTTPException(403, "You are not authorized to download this invoice.")

    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    W, H = A4  # 595 x 842 pts

    # ── Header band ──────────────────────────────────────────────────────────
    c.setFillColorRGB(0.33, 0.44, 0.88)
    c.rect(0, H - 90, W, 90, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(45, H - 42, "BRIGHTLOOP")
    c.setFont("Helvetica", 11)
    c.drawString(45, H - 62, "Subscription Invoice")
    c.setFont("Helvetica", 9)
    c.drawRightString(W - 45, H - 42, inv.number)
    c.drawRightString(W - 45, H - 58, f"Status: {inv.status}")

    # ── Bill-to block ────────────────────────────────────────────────────────
    c.setFillColorRGB(0.15, 0.20, 0.30)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(45, H - 120, "BILLED TO")
    c.setFont("Helvetica", 10)
    c.drawString(45, H - 136, inv.customer.name)
    c.drawString(45, H - 150, inv.customer.email)

    # ── Invoice meta ─────────────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 10)
    c.drawString(350, H - 120, "INVOICE DETAILS")
    c.setFont("Helvetica", 10)
    c.drawString(350, H - 136, f"Invoice No:     {inv.number}")
    c.drawString(350, H - 150, f"Billing date:   {inv.billing_date}")
    c.drawString(350, H - 164, f"Due date:       {inv.due_date}")

    # ── Divider ──────────────────────────────────────────────────────────────
    c.setStrokeColorRGB(0.87, 0.90, 0.95)
    c.line(45, H - 190, W - 45, H - 190)

    # ── Line items ───────────────────────────────────────────────────────────
    y = H - 215
    c.setFillColorRGB(0.60, 0.65, 0.75)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(45, y, "DESCRIPTION")
    c.drawRightString(W - 45, y, "AMOUNT (INR)")
    y -= 18

    c.setFillColorRGB(0.15, 0.20, 0.30)
    c.setFont("Helvetica", 10)
    c.drawString(45, y, "Subscription charge")
    c.drawRightString(W - 45, y, f"{inv.subtotal:,.2f}")

    if inv.discount_amount > 0:
        y -= 18
        c.drawString(45, y, "Discount")
        c.drawRightString(W - 45, y, f"- {inv.discount_amount:,.2f}")

    if inv.tax_amount > 0:
        y -= 18
        c.drawString(45, y, "Tax")
        c.drawRightString(W - 45, y, f"{inv.tax_amount:,.2f}")

    y -= 12
    c.setStrokeColorRGB(0.87, 0.90, 0.95)
    c.line(45, y, W - 45, y)

    y -= 24
    c.setFont("Helvetica-Bold", 13)
    c.setFillColorRGB(0.33, 0.44, 0.88)
    c.drawString(45, y, "Total Due")
    c.drawRightString(W - 45, y, f"INR {inv.total:,.2f}")

    # ── Footer ───────────────────────────────────────────────────────────────
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.55, 0.62, 0.72)
    c.drawString(45, 40, "Generated by Brightloop Subscription Management · brightloop.com")
    c.drawRightString(W - 45, 40, f"Invoice {inv.number}")

    c.save()
    buf.seek(0)

    safe_name = inv.number.replace("/", "-")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )

