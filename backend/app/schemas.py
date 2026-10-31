from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=9)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: str
    is_active: bool


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

class ProductIn(BaseModel):
    name: str
    product_type: str = "Software"
    sales_price: float = Field(ge=0)
    cost_price: float = Field(default=0, ge=0)
    notes: str = ""


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    product_type: Optional[str] = None
    sales_price: Optional[float] = Field(default=None, ge=0)
    cost_price: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None
    active: Optional[bool] = None


class ProductVariantIn(BaseModel):
    name: str
    price_adjustment: float = 0.0


# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------

class PlanIn(BaseModel):
    name: str
    price: float = Field(ge=0)
    interval: str
    min_quantity: int = Field(default=1, ge=1)
    trial_days: int = Field(default=0, ge=0)
    starts_on: date | None = None
    ends_on: date | None = None
    auto_close: bool = False
    allow_pause: bool = True
    allow_early_close: bool = True


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    interval: Optional[str] = None
    min_quantity: Optional[int] = Field(default=None, ge=1)
    trial_days: Optional[int] = Field(default=None, ge=0)
    starts_on: Optional[date] = None
    ends_on: Optional[date] = None
    auto_close: Optional[bool] = None
    allow_pause: Optional[bool] = None
    allow_early_close: Optional[bool] = None
    active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

class CustomerIn(BaseModel):
    name: str
    email: EmailStr
    company: str = ""
    phone: str = ""


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    company: Optional[str] = None
    phone: Optional[str] = None


# ---------------------------------------------------------------------------
# Subscriptions & Lifecycle
# ---------------------------------------------------------------------------

class SubscriptionIn(BaseModel):
    customer_id: int
    plan_id: int
    product_id: int
    quantity: int = Field(default=1, ge=1)
    tax_rate: float = Field(default=0, ge=0, le=100)
    start_date: date
    expiry_date: date | None = None
    payment_terms: str = "Due on receipt"
    discount_id: int | None = None


class ChangePlanIn(BaseModel):
    new_plan_id: int
    prorate: bool = True


class CancelSubscriptionIn(BaseModel):
    immediately: bool = False
    reason: str = "Customer requested cancellation"


class StatusIn(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Discounts
# ---------------------------------------------------------------------------

class DiscountIn(BaseModel):
    name: str
    code: Optional[str] = None
    kind: str  # percentage | fixed
    value: float = Field(gt=0)
    min_quantity: int = 1
    starts_on: date | None = None
    ends_on: date | None = None
    usage_limit: int | None = None


class DiscountUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    kind: Optional[str] = None
    value: Optional[float] = Field(default=None, gt=0)
    min_quantity: Optional[int] = None
    starts_on: Optional[date] = None
    ends_on: Optional[date] = None
    usage_limit: Optional[int] = None
    active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Payments & Gateways
# ---------------------------------------------------------------------------

class PaymentIn(BaseModel):
    invoice_id: int
    method: str
    amount: float = Field(gt=0)
    paid_on: date
    note: str = ""
    gateway: str = "Manual"
    transaction_id: Optional[str] = None


class CheckoutSessionIn(BaseModel):
    invoice_id: int
    gateway: str  # razorpay | stripe
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class WebhookEventIn(BaseModel):
    gateway: str  # razorpay | stripe
    event: str
    payload: dict
    signature: Optional[str] = None


# ---------------------------------------------------------------------------
# Notifications & Settings
# ---------------------------------------------------------------------------

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    kind: str
    is_read: bool
    created_at: datetime


class BusinessSettingIn(BaseModel):
    company_name: str
    support_email: EmailStr
    currency: str = "INR"
    tax_id: str = ""
    invoice_prefix: str = "INV"
    address: str = ""
    logo_url: str = ""
    website: str = ""
