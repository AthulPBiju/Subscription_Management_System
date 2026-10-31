from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as rl_canvas

from ..database import get_db
from ..models import User, Invoice, Customer, BusinessSetting
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

    # Load business settings
    settings_rows = db.scalars(select(BusinessSetting)).all()
    b_settings = {row.key: row.value for row in settings_rows}
    company_name = b_settings.get("company_name", "BRIGHTLOOP")
    support_email = b_settings.get("support_email", "support@brightloop.com")
    currency = b_settings.get("currency", "INR")
    tax_id = b_settings.get("tax_id", "")
    address = b_settings.get("address", "")

    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    W, H = A4  # 595 x 842 pts

    # ── Header band ──────────────────────────────────────────────────────────
    c.setFillColorRGB(0.33, 0.44, 0.88)
    c.rect(0, H - 95, W, 95, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(45, H - 42, company_name.upper())
    c.setFont("Helvetica", 10)
    c.drawString(45, H - 60, "Official Subscription Tax Invoice")
    if tax_id:
        c.setFont("Helvetica", 8)
        c.drawString(45, H - 74, f"Tax / GST ID: {tax_id}")

    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(W - 45, H - 42, inv.number)
    c.setFont("Helvetica", 9)
    c.drawRightString(W - 45, H - 58, f"Status: {inv.status.upper()}")

    # ── Bill-to block ────────────────────────────────────────────────────────
    c.setFillColorRGB(0.15, 0.20, 0.30)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(45, H - 125, "BILLED TO")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(45, H - 141, inv.customer.name if inv.customer else f"Customer #{inv.customer_id}")
    c.setFont("Helvetica", 9)
    if inv.customer and inv.customer.company:
        c.drawString(45, H - 155, inv.customer.company)
        c.drawString(45, H - 169, inv.customer.email)
    elif inv.customer:
        c.drawString(45, H - 155, inv.customer.email)

    # ── Invoice meta ─────────────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 10)
    c.drawString(340, H - 125, "INVOICE DETAILS")
    c.setFont("Helvetica", 9)
    c.drawString(340, H - 141, f"Invoice No:       {inv.number}")
    c.drawString(340, H - 155, f"Billing Date:     {inv.billing_date}")
    c.drawString(340, H - 169, f"Payment Due:      {inv.due_date}")
    if inv.subscription:
        c.drawString(340, H - 183, f"Contract:         {inv.subscription.number}")

    # ── Divider ──────────────────────────────────────────────────────────────
    c.setStrokeColorRGB(0.87, 0.90, 0.95)
    c.line(45, H - 200, W - 45, H - 200)

    # ── Line items header ────────────────────────────────────────────────────
    y = H - 220
    c.setFillColorRGB(0.60, 0.65, 0.75)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(45, y, "LINE ITEM DESCRIPTION")
    c.drawString(320, y, "QTY")
    c.drawString(370, y, "UNIT PRICE")
    c.drawRightString(W - 45, y, f"AMOUNT ({currency})")
    y -= 16

    # ── Line items data ──────────────────────────────────────────────────────
    c.setFillColorRGB(0.15, 0.20, 0.30)
    c.setFont("Helvetica", 9)

    item_desc = "Subscription Service"
    qty = 1
    unit_price = inv.subtotal
    if inv.subscription:
        prod_name = inv.subscription.product.name if inv.subscription.product else "Service"
        plan_name = inv.subscription.plan.name if inv.subscription.plan else "Plan"
        interval = inv.subscription.plan.interval if inv.subscription.plan else ""
        item_desc = f"{prod_name} — {plan_name} ({interval})"
        qty = inv.subscription.quantity
        unit_price = inv.subscription.unit_price

    c.drawString(45, y, item_desc)
    c.drawString(320, y, str(qty))
    c.drawString(370, y, f"{unit_price:,.2f}")
    c.drawRightString(W - 45, y, f"{inv.subtotal:,.2f}")

    if inv.discount_amount > 0:
        y -= 18
        c.drawString(45, y, "Promotional Discount Applied")
        c.drawRightString(W - 45, y, f"- {inv.discount_amount:,.2f}")

    if inv.tax_amount > 0:
        y -= 18
        c.drawString(45, y, f"Tax / VAT ({inv.subscription.tax_rate if inv.subscription else 18}%)")
        c.drawRightString(W - 45, y, f"{inv.tax_amount:,.2f}")

    y -= 14
    c.setStrokeColorRGB(0.87, 0.90, 0.95)
    c.line(45, y, W - 45, y)

    y -= 24
    c.setFont("Helvetica-Bold", 12)
    c.setFillColorRGB(0.33, 0.44, 0.88)
    c.drawString(45, y, "TOTAL DUE")
    c.drawRightString(W - 45, y, f"{currency} {inv.total:,.2f}")

    # ── Notes & Terms ────────────────────────────────────────────────────────
    y -= 35
    c.setFont("Helvetica-Bold", 8)
    c.setFillColorRGB(0.45, 0.52, 0.62)
    c.drawString(45, y, "PAYMENT TERMS & NOTES")
    c.setFont("Helvetica", 8)
    y -= 14
    c.drawString(45, y, f"Payment is due on or before {inv.due_date}. For queries contact {support_email}.")
    if address:
        y -= 12
        c.drawString(45, y, f"Issuer: {company_name}, {address}")

    # ── Footer ───────────────────────────────────────────────────────────────
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.55, 0.62, 0.72)
    c.drawString(45, 40, f"Generated automatically by {company_name} Subscription Management")
    c.drawRightString(W - 45, 40, f"Page 1 of 1 · Invoice {inv.number}")

    c.save()
    buf.seek(0)

    safe_name = inv.number.replace("/", "-")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )

