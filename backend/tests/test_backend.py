"""
Brightloop Comprehensive Test Suite.
Tests: security, billing, proration, subscriptions, notifications, gateways,
       settings, audit log, invoice numbering uniqueness, cancel-at-period-end.
"""
import unittest
from datetime import date, timedelta, datetime

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import (
    User, Customer, Product, ProductVariant, Plan, Discount,
    Subscription, Invoice, Payment, Notification, SubscriptionHistory,
    BusinessSetting, AuditLog,
)
from app.security import (
    hash_password, verify_password, valid_password, create_token,
)
from app.services.billing import add_interval, discount_value, generate_due_invoices
from app.services.proration import calculate_proration
from app.services.notifications import create_notification
from app.services.payment_gateway import create_gateway_order, process_webhook_event
from app.api.subscriptions import TRANSITIONS


class TestAppEntrypoint(unittest.TestCase):
    def test_app_import_and_routes(self):
        """Verify app.main imports cleanly and all API routers are registered."""
        import app.main
        self.assertIsNotNone(app.main.app)
        route_paths = [route.path for route in app.main.app.routes]
        self.assertIn("/api/health", route_paths)
        self.assertIn("/api/auth/login", route_paths)
        self.assertIn("/api/dashboard", route_paths)
        self.assertIn("/api/settings", route_paths)
        self.assertIn("/api/audit", route_paths)
        self.assertIn("/api/subscriptions", route_paths)
        self.assertIn("/api/invoices", route_paths)


class TestSecurity(unittest.TestCase):
    def test_password_complexity(self):
        self.assertTrue(valid_password("ValidPassword@123"))
        self.assertTrue(valid_password("Brightloop#2026"))
        self.assertFalse(valid_password("Short1!"))
        self.assertFalse(valid_password("lowercase@123"))
        self.assertFalse(valid_password("UPPERCASE@123"))
        self.assertFalse(valid_password("NoSpecial1234"))

    def test_hash_and_verify_password(self):
        plain = "SecurePass#999"
        hashed = hash_password(plain)
        self.assertNotEqual(plain, hashed)
        self.assertTrue(verify_password(plain, hashed))
        self.assertFalse(verify_password("WrongPassword#999", hashed))

    def test_jwt_token_generation(self):
        user = User(id=42, name="Test User", email="test@example.com", role="admin")
        token = create_token(user)
        self.assertIsInstance(token, str)
        self.assertGreater(len(token), 20)


class TestBillingAndProration(unittest.TestCase):
    def test_add_interval(self):
        d = date(2026, 1, 15)
        self.assertEqual(add_interval(d, "daily"), date(2026, 1, 16))
        self.assertEqual(add_interval(d, "weekly"), date(2026, 1, 22))
        self.assertEqual(add_interval(d, "monthly"), date(2026, 2, 15))
        self.assertEqual(add_interval(d, "yearly"), date(2027, 1, 15))

    def test_add_interval_month_end(self):
        d = date(2026, 1, 31)
        self.assertEqual(add_interval(d, "monthly"), date(2026, 2, 28))

    def test_add_interval_yearly_leap(self):
        d = date(2024, 2, 29)
        self.assertEqual(add_interval(d, "yearly"), date(2025, 2, 28))

    def test_proration_upgrade(self):
        sub = Subscription(
            number="SUB-PRORATE-01",
            unit_price=1000.0,
            quantity=1,
            start_date=date(2026, 5, 1),
            next_billing_date=date(2026, 5, 31),
        )
        new_plan = Plan(name="Enterprise", price=3000.0, interval="monthly")
        today = date(2026, 5, 16)
        res = calculate_proration(sub, new_plan, today)
        self.assertEqual(res["days_remaining"], 15)
        self.assertEqual(res["total_days_in_cycle"], 30)
        self.assertEqual(res["unused_credit"], 500.0)
        self.assertEqual(res["new_plan_charge"], 1500.0)
        self.assertEqual(res["net_amount"], 1000.0)

    def test_proration_downgrade(self):
        """Downgrade should produce a credit (negative net)."""
        sub = Subscription(
            number="SUB-PRORATE-02",
            unit_price=3000.0,
            quantity=1,
            start_date=date(2026, 5, 1),
            next_billing_date=date(2026, 5, 31),
        )
        new_plan = Plan(name="Basic", price=1000.0, interval="monthly")
        today = date(2026, 5, 16)
        res = calculate_proration(sub, new_plan, today)
        self.assertEqual(res["days_remaining"], 15)
        self.assertEqual(res["total_days_in_cycle"], 30)
        self.assertEqual(res["unused_credit"], 1500.0)   # 3000 * 15/30
        self.assertEqual(res["new_plan_charge"], 500.0)  # 1000 * 15/30
        self.assertLess(res["net_amount"], 0)             # credit

    def test_invoice_number_uniqueness(self):
        """Billing run must not produce duplicate invoice numbers across two subs."""
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        plan = Plan(name="Monthly", price=500.0, interval="monthly", min_quantity=1,
                    allow_pause=True, allow_early_close=True)
        db.add(plan)
        u1 = User(name="A", email="a@a.com", hashed_password="x", role="customer")
        u2 = User(name="B", email="b@b.com", hashed_password="x", role="customer")
        db.add_all([u1, u2])
        db.commit()
        c1 = Customer(user_id=u1.id, name="A Corp", email="a@a.com")
        c2 = Customer(user_id=u2.id, name="B Corp", email="b@b.com")
        db.add_all([c1, c2])
        prod = Product(name="P", sales_price=500)
        db.add(prod)
        db.commit()

        today = date.today()
        s1 = Subscription(number="S-001", customer_id=c1.id, plan_id=plan.id,
                           product_id=prod.id, quantity=1, unit_price=500, tax_rate=0,
                           status="Active", start_date=today, next_billing_date=today)
        s2 = Subscription(number="S-002", customer_id=c2.id, plan_id=plan.id,
                           product_id=prod.id, quantity=1, unit_price=500, tax_rate=0,
                           status="Active", start_date=today, next_billing_date=today)
        db.add_all([s1, s2])
        db.commit()

        created = generate_due_invoices(db, today)
        self.assertEqual(len(created), 2)
        nums = [inv.number for inv in created]
        self.assertEqual(len(set(nums)), 2, f"Duplicate invoice numbers: {nums}")
        db.close()
        Base.metadata.drop_all(bind=engine)

    def test_cancel_at_period_end(self):
        """Billing run must close subscriptions flagged cancel_at_period_end."""
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        plan = Plan(name="M", price=100.0, interval="monthly", min_quantity=1,
                    allow_pause=True, allow_early_close=True)
        db.add(plan)
        u = User(name="C", email="c@c.com", hashed_password="x", role="customer")
        db.add(u)
        db.commit()
        c = Customer(user_id=u.id, name="C Corp", email="c@c.com")
        prod = Product(name="P", sales_price=100)
        db.add_all([c, prod])
        db.commit()

        today = date.today()
        sub = Subscription(number="S-CANCEL-001", customer_id=c.id, plan_id=plan.id,
                            product_id=prod.id, quantity=1, unit_price=100, tax_rate=0,
                            status="Active", start_date=today, next_billing_date=today,
                            cancel_at_period_end=True)
        db.add(sub)
        db.commit()

        created = generate_due_invoices(db, today)
        db.refresh(sub)
        self.assertEqual(sub.status, "Closed")
        self.assertEqual(len(created), 0)  # No invoice generated for cancelled sub
        db.close()
        Base.metadata.drop_all(bind=engine)


class TestSubscriptionTransitions(unittest.TestCase):
    def test_valid_transitions(self):
        """All allowed transitions match the documented lifecycle."""
        self.assertIn("Active", TRANSITIONS["Confirmed"])
        self.assertIn("Paused", TRANSITIONS["Active"])
        self.assertEqual(TRANSITIONS["Closed"], [])

    def test_terminal_state(self):
        """Closed is a terminal state with no further transitions."""
        self.assertEqual(TRANSITIONS["Closed"], [])

    def test_draft_to_active_invalid(self):
        """Draft cannot jump directly to Active — must go through Confirmed."""
        self.assertNotIn("Active", TRANSITIONS["Draft"])


class TestPaymentGateways(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.user = User(name="Bob", email="bob@test.com", hashed_password="x", role="customer")
        self.db.add(self.user)
        self.db.commit()

        self.customer = Customer(user_id=self.user.id, name="Bob Corp", email="bob@test.com")
        self.db.add(self.customer)
        self.db.commit()

        self.inv = Invoice(
            number="INV-GW-001",
            subscription_id=1,
            customer_id=self.customer.id,
            billing_date=date.today(),
            due_date=date.today(),
            subtotal=2000.0,
            total=2000.0,
            status="Confirmed",
        )
        self.db.add(self.inv)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_gateway_order_creation(self):
        rzp_order = create_gateway_order(self.db, self.inv, "razorpay")
        self.assertEqual(rzp_order["gateway"], "razorpay")
        self.assertEqual(rzp_order["amount"], 200000)  # Paise

        stripe_order = create_gateway_order(self.db, self.inv, "stripe")
        self.assertEqual(stripe_order["gateway"], "stripe")
        self.assertTrue(stripe_order["session_id"].startswith("cs_test_"))

    def test_gateway_order_amounts_correct(self):
        """Amount must be invoice total * 100 (paise/cents)."""
        order = create_gateway_order(self.db, self.inv, "razorpay")
        self.assertEqual(order["amount"], int(self.inv.total * 100))

    def test_idempotent_webhook_processing(self):
        payload = {
            "invoice_id": self.inv.id,
            "transaction_id": "txn_unique_999",
            "amount": 2000.0,
        }
        res1 = process_webhook_event(self.db, "stripe", "payment_intent.succeeded", payload)
        self.assertEqual(res1["status"], "success")
        self.assertEqual(self.inv.status, "Paid")

        res2 = process_webhook_event(self.db, "stripe", "payment_intent.succeeded", payload)
        self.assertEqual(res2["status"], "duplicate")

    def test_webhook_unknown_invoice(self):
        payload = {"invoice_id": 9999, "transaction_id": "txn_noexist", "amount": 100.0}
        res = process_webhook_event(self.db, "stripe", "payment_intent.succeeded", payload)
        self.assertEqual(res["status"], "error")


class TestNotifications(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_create_notification(self):
        n = create_notification(self.db, "Renewal notice", "Your renewal is approaching", kind="warning")
        self.assertFalse(n.is_read)
        self.assertEqual(n.kind, "warning")

    def test_broadcast_notification_no_user(self):
        n = create_notification(self.db, "System alert", "Maintenance window tonight", kind="info")
        self.assertIsNone(n.user_id)

    def test_notification_kinds(self):
        for kind in ("info", "success", "warning", "danger"):
            n = create_notification(self.db, f"Test {kind}", "body", kind=kind)
            self.assertEqual(n.kind, kind)


class TestBusinessSettings(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_setting_storage(self):
        s = BusinessSetting(key="company_name", value="Acme Corp")
        self.db.add(s)
        self.db.commit()
        loaded = self.db.get(BusinessSetting, "company_name")
        self.assertEqual(loaded.value, "Acme Corp")

    def test_setting_update(self):
        s = BusinessSetting(key="currency", value="INR")
        self.db.add(s)
        self.db.commit()
        s.value = "USD"
        self.db.commit()
        loaded = self.db.get(BusinessSetting, "currency")
        self.assertEqual(loaded.value, "USD")


class TestDiscountEngine(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def _make_sub_with_discount(self, kind, value, usage_limit=None, used_count=0,
                                  starts_on=None, ends_on=None, min_qty=1):
        plan = Plan(name="M", price=100.0, interval="monthly", min_quantity=1,
                    allow_pause=True, allow_early_close=True)
        self.db.add(plan)
        user = User(name="X", email="x@x.com", hashed_password="x", role="customer")
        self.db.add(user)
        self.db.commit()
        customer = Customer(user_id=user.id, name="X Co", email="x@x.com")
        prod = Product(name="P", sales_price=100)
        self.db.add_all([customer, prod])
        discount = Discount(
            name="TEST", kind=kind, value=value,
            usage_limit=usage_limit, used_count=used_count,
            starts_on=starts_on, ends_on=ends_on,
            min_quantity=min_qty, active=True,
        )
        self.db.add(discount)
        self.db.commit()
        sub = Subscription(
            number="S-DISC-001", customer_id=customer.id, plan_id=plan.id,
            product_id=prod.id, quantity=2, unit_price=100, tax_rate=0,
            status="Active", start_date=date.today(), next_billing_date=date.today(),
            discount_id=discount.id,
        )
        sub.discount = discount
        self.db.add(sub)
        self.db.commit()
        return sub

    def test_percentage_discount(self):
        sub = self._make_sub_with_discount("percentage", 20)
        disc = discount_value(self.db, sub, 200.0, date.today())
        self.assertEqual(disc, 40.0)

    def test_fixed_discount(self):
        sub = self._make_sub_with_discount("fixed", 50)
        disc = discount_value(self.db, sub, 200.0, date.today())
        self.assertEqual(disc, 50.0)

    def test_discount_exhausted(self):
        sub = self._make_sub_with_discount("percentage", 10, usage_limit=5, used_count=5)
        disc = discount_value(self.db, sub, 200.0, date.today())
        self.assertEqual(disc, 0.0)

    def test_discount_expired(self):
        yesterday = date.today() - timedelta(days=1)
        sub = self._make_sub_with_discount("percentage", 10, ends_on=yesterday)
        disc = discount_value(self.db, sub, 200.0, date.today())
        self.assertEqual(disc, 0.0)

    def test_discount_not_yet_active(self):
        tomorrow = date.today() + timedelta(days=1)
        sub = self._make_sub_with_discount("percentage", 10, starts_on=tomorrow)
        disc = discount_value(self.db, sub, 200.0, date.today())
        self.assertEqual(disc, 0.0)

    def test_discount_min_quantity_not_met(self):
        sub = self._make_sub_with_discount("percentage", 10, min_qty=5)
        # subscription quantity = 2, min_qty = 5
        disc = discount_value(self.db, sub, 200.0, date.today())
        self.assertEqual(disc, 0.0)

    def test_discount_cannot_exceed_subtotal(self):
        sub = self._make_sub_with_discount("fixed", 9999)
        disc = discount_value(self.db, sub, 100.0, date.today())
        self.assertEqual(disc, 100.0)  # capped at subtotal


if __name__ == "__main__":
    unittest.main()
