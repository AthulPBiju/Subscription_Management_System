# Brightloop — Subscription Management System

A market-ready, full-stack B2B SaaS subscription billing and lifecycle platform built with **FastAPI (Python)**, **React + Vite**, **SQLAlchemy ORM**, and modern financial ledger mechanics.

---

## 🌟 Key Features

- **JWT Authentication & RBAC:** Admin, Staff, and Customer roles with automatic session token expiration and renewal handling.
- **Dedicated Customer Self-Service Portal (`/portal`):** Subscribers can view active services, renewal dates, change/upgrade plans with real-time proration, cancel subscriptions, download PDF invoices, and pay directly.
- **Advanced Subscription Lifecycle:** Draft → Quotation → Confirmed → Active → Paused / Closed state machine with automated interval advancement (daily, weekly, monthly, yearly).
- **Automated Billing Engine (`POST /api/billing/run`):** Generates due invoices for active subscriptions with strict duplicate cycle protection (`uq_invoice_subscription_cycle`).
- **Proration Calculator:** Automatically calculates daily credits and debits when upgrading or downgrading plans mid-cycle.
- **Payment Gateway Architecture:** Integrated Razorpay and Stripe sandbox workflows with idempotent webhook capture.
- **Transactional Notifications & In-App Alerts:** In-app notification center for plan updates, payment confirmations, and renewals.
- **Comprehensive SaaS Analytics:** Real-time calculation of Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), ARPU, Customer Churn Rate, and LTV.
- **Financial CSV & Branded PDF Statements:** One-click CSV export of the financial invoice ledger and downloadable PDF invoices generated via ReportLab.
- **Catalog Management:** Products, cost/sales prices, and variant add-ons.

---

## 🏗️ Architecture Overview

```
brightloop-subscription-system/
├── backend/
│   ├── app/
│   │   ├── api/                    # Modular FastAPI routers
│   │   │   ├── auth.py             # Login, register, current user, staff invite
│   │   │   ├── products.py         # Catalog CRUD & variant management
│   │   │   ├── plans.py            # Billing plans & intervals
│   │   │   ├── customers.py        # Customer records & unique validation
│   │   │   ├── subscriptions.py    # Contracts, proration, upgrades & lifecycle
│   │   │   ├── invoices.py         # Statements & ReportLab PDF generator
│   │   │   ├── payments.py         # Payment ledger & balance settlements
│   │   │   ├── discounts.py        # Promotional codes & volume discounts
│   │   │   ├── dashboard.py        # Live operational metrics
│   │   │   ├── billing.py          # Automated invoice generator
│   │   │   ├── gateways.py         # Stripe & Razorpay order/webhook endpoints
│   │   │   ├── notifications.py    # Notification center endpoints
│   │   │   ├── analytics.py        # MRR, ARR, ARPU, Churn & CSV export
│   │   │   └── portal.py           # Customer self-service portal
│   │   ├── core/                   # App configuration & serialization utils
│   │   ├── services/               # Proration, billing, gateways, notifications
│   │   ├── database.py             # Database session manager
│   │   ├── models.py               # Declarative SQLAlchemy models
│   │   ├── schemas.py              # Pydantic validation schemas
│   │   ├── security.py             # Bcrypt hashing & JWT management
│   │   └── main.py                 # Application entry point
│   ├── tests/                      # Automated unit & integration test suite
│   ├── requirements.txt            # Python dependencies
│   └── Dockerfile                  # Production container image
│
├── frontend/
│   ├── src/
│   │   ├── components/             # Reusable UI (Layout, Modal, Stat, GatewayModal)
│   │   ├── pages/                  # Route views (Dashboard, Portal, Customers, etc.)
│   │   ├── hooks/                  # Data fetching hooks (useRows)
│   │   ├── api.js                  # Axios client with 401 interceptor & PDF helper
│   │   ├── App.jsx                 # Route controller & authentication state
│   │   └── main.jsx                # Application root
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
│
├── docker-compose.yml              # Multi-container local production stack
├── PROJECT_STATUS.md               # Phase-by-phase implementation log
└── KNOWN_ISSUES.md                 # Roadmap & backlog items
```

---

## 🚀 Quickstart Guide

### 1. Backend Setup

```powershell
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
- API Base: `http://127.0.0.1:8000`
- Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup

Open a second terminal:
```powershell
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:5173`

---

## 🔑 Demo Credentials

The backend automatically seeds these test accounts on initial boot:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@brightloop.com` | `Brightloop@123` |
| **Staff** | `staff@brightloop.com` | `Brightloop@123` |
| **Customer** | `customer@brightloop.com` | `Brightloop@123` |

> *Note:* Signing in as `customer@brightloop.com` automatically loads the **Customer Self-Service Portal** (`/portal`), allowing the customer to view and manage their own contracts, upgrade plans, and settle invoices. Signing in as an Admin or Staff member opens the central business operations dashboard.

---

## 🧪 Running Automated Tests

Run the full backend test suite:
```powershell
cd backend
.venv\Scripts\python.exe -m unittest discover -s tests -v
```

---

## 🐳 Docker Deployment

To launch the complete containerized stack:
```bash
docker-compose up --build
```
- Frontend will be accessible at: `http://localhost:5173`
- Backend API will be accessible at: `http://localhost:8000`
