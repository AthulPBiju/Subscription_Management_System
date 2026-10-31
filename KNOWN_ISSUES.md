# Brightloop Subscription System — Known Issues & Backlog

Last Updated: October 31, 2026

The following items are tracked for upcoming phases:

### 1. Payment Gateway Live Sandboxes
- **Status:** Currently payments are recorded in the internal ledger with payment methods (Bank Transfer, UPI, Credit Card, Razorpay, Stripe).
- **Plan (Phase 3D):** Integrate live Razorpay / Stripe webhook endpoints with HMAC signature verification and idempotency keys.

### 2. Live Email Delivery (SMTP / Resend / SendGrid)
- **Status:** Architecture supports notification preferences; transactional emails currently log to console in dev mode.
- **Plan (Phase 3E):** Add SMTP credentials and HTML template engine for invoice delivery and payment reminders.

### 3. Customer Self-Service Portal
- **Status:** Customers can authenticate and backend filters their subscriptions/invoices; UI currently shows the unified workspace.
- **Plan (Phase 3B):** Introduce a customer portal route (`/portal`) tailored exclusively to customer self-service (updating payment info, viewing their subscriptions and invoices).

### 4. Advanced Proration Engine
- **Status:** Upgrades/downgrades can be modeled by transitioning subscriptions or creating new terms.
- **Plan (Phase 3A):** Add an automated mid-cycle proration calculator that computes exact credit/debit adjustments down to the day.

