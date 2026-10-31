# Brightloop Subscription System — Architecture & Roadmap

Last Updated: October 31, 2026

## Feature Status

All core and advanced SaaS modules are fully implemented, verified, and ready for commercial deployment:

| Capability | Status | Description |
|---|---|---|
| **Proration Engine** | ✅ Completed | Automated mid-cycle upgrade/downgrade calculations down to the day with immediate invoicing |
| **Customer Portal** | ✅ Completed | Dedicated self-service portal (`/portal`) for subscribers to manage plans, cancel, and pay invoices |
| **Payment Gateways** | ✅ Completed | Razorpay & Stripe checkout architecture with idempotent webhook handling |
| **Subscription Lifecycle** | ✅ Completed | Full state machine (`Draft` → `Quotation` → `Confirmed` → `Active` ⇄ `Paused` → `Closed`) with audit history |
| **Cancel at Period End** | ✅ Completed | Scheduled end-of-cycle cancellation enforcement during automated billing runs |
| **Business Settings** | ✅ Completed | Editable workspace profile, invoice numbering prefix, tax ID, and multi-currency support |
| **Audit Log** | ✅ Completed | Immutable tracking of administrative events and operations |
| **Automated Invoicing & PDF**| ✅ Completed | Due date detection, discount engine, tax breakdown, and branded A4 PDF generator |
| **Financial Intelligence** | ✅ Completed | Real-time calculation of MRR, ARR, ARPU, LTV, Churn Rate, and CSV export |

## Future Expansion Roadmap

The following optional enhancements can be configured for enterprise deployments:
- **Direct SMTP Provider Integration:** Configure credentials in `backend/.env` for automated outbound emails via SendGrid, Resend, or AWS SES.
- **Single Sign-On (SSO):** SAML / Okta / Google Workspace integration for enterprise multi-tenant authentication.
- **Multi-Tenant Database Sharding:** Isolate database schemas per enterprise client for private cloud installations.
