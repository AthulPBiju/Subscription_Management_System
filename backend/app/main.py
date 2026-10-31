"""
Brightloop Subscription API — application entry point.

All route logic lives in app/api/*.py routers.
This file only wires middleware, routers, DB init, and seeding.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .core.config import settings as app_settings
from .database import Base, engine, SessionLocal
from .models import User, Customer, Product, ProductVariant, Plan
from .security import hash_password
from .api import (
    auth, products, plans, customers, subscriptions,
    invoices, payments, discounts, dashboard, billing,
    gateways, notifications, analytics, portal,
    settings as settings_api, audit,
)

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Brightloop Subscription API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — reads allowed origin from environment so deployment configs just set FRONTEND_ORIGIN
_origins = list({
    app_settings.FRONTEND_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router,          prefix="/api/auth",          tags=["Authentication"])
app.include_router(dashboard.router,     prefix="/api",               tags=["Dashboard"])
app.include_router(products.router,      prefix="/api/products",      tags=["Products"])
app.include_router(plans.router,         prefix="/api/plans",         tags=["Plans"])
app.include_router(customers.router,     prefix="/api/customers",     tags=["Customers"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["Subscriptions"])
app.include_router(invoices.router,      prefix="/api/invoices",      tags=["Invoices"])
app.include_router(payments.router,      prefix="/api/payments",      tags=["Payments"])
app.include_router(discounts.router,     prefix="/api/discounts",     tags=["Discounts"])
app.include_router(billing.router,       prefix="/api/billing",       tags=["Billing"])
app.include_router(gateways.router,      prefix="/api/gateways",      tags=["Payment Gateways"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(analytics.router,     prefix="/api/analytics",     tags=["Analytics & Reporting"])
app.include_router(portal.router,        prefix="/api/portal",        tags=["Customer Portal"])
app.include_router(settings_api.router,  prefix="/api/settings",      tags=["Business Settings"])
app.include_router(audit.router,         prefix="/api/audit",         tags=["Audit Log"])

# ---------------------------------------------------------------------------
# DB init + seeding
# ---------------------------------------------------------------------------

Base.metadata.create_all(bind=engine)


def seed() -> None:
    """Create demo accounts and sample catalog on the very first run."""
    db = SessionLocal()
    try:
        if not db.scalar(select(User).where(User.email == "admin@brightloop.com")):
            db.add_all([
                User(
                    name="Brightloop Admin",
                    email="admin@brightloop.com",
                    hashed_password=hash_password("Brightloop@123"),
                    role="admin",
                ),
                User(
                    name="Operations Staff",
                    email="staff@brightloop.com",
                    hashed_password=hash_password("Brightloop@123"),
                    role="staff",
                ),
                User(
                    name="Demo Customer",
                    email="customer@brightloop.com",
                    hashed_password=hash_password("Brightloop@123"),
                    role="customer",
                ),
            ])
            db.commit()

        customer_user = db.scalar(select(User).where(User.email == "customer@brightloop.com"))
        if customer_user and not db.scalar(select(Customer).where(Customer.user_id == customer_user.id)):
            db.add(Customer(
                user_id=customer_user.id,
                name=customer_user.name,
                email=customer_user.email,
                company="Demo Store",
            ))
            db.commit()

        if not db.scalar(select(Product)):
            p = Product(
                name="Brightloop Business Suite",
                product_type="Software",
                sales_price=2499,
                cost_price=700,
                notes="Core business subscription",
            )
            db.add(p)
            db.commit()
            db.add_all([
                ProductVariant(product_id=p.id, name="Standard", price_adjustment=0),
                ProductVariant(product_id=p.id, name="Odoo",     price_adjustment=560),
                Plan(name="Monthly", price=2499,  interval="monthly", min_quantity=1,
                     allow_pause=True,  allow_early_close=True),
                Plan(name="Annual",  price=24990, interval="yearly",  min_quantity=1,
                     allow_pause=False, allow_early_close=True),
            ])
            db.commit()
    finally:
        db.close()


seed()

# ---------------------------------------------------------------------------
# Utility endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Root"])
def root():
    return {"name": "Brightloop Subscription API", "docs": "/docs"}


@app.get("/api/health", tags=["Root"])
def health():
    return {"status": "ok", "version": "1.0.0"}
