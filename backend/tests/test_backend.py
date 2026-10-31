"""
Brightloop Unit & Integration Test Suite.
Built with Python's standard unittest framework — runs without external dependencies.
"""
import unittest
from datetime import date, timedelta
from io import BytesIO

from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import (
    User, Customer, Product, ProductVariant, Plan, Discount,
    Subscription, Invoice, Payment, Notification, SubscriptionHistory,
)
from app.security import (
    hash_password, verify_password, valid_password, create_token,
)
from app.services.billing import add_interval, discount_value, generate_due_invoices
from app.services.proration import calculate_proration
from app.services.notifications import create_notification
from app.services.payment_gateway import create_gateway_order, process_webhook_event
from app.api.subscriptions import TRANSITIONS


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

    def test_proration_upgrade(self):
        sub = Subscription(
            number="SUB-PRORATE-01",
            unit_price=1000.0,
            quantity=1,
            start_date=date(2026, 5, 1),
            next_billing_date=date(2026, 5, 31),
        )
        new_plan = Plan(name="Enterprise", price=3000.0, interval="monthly")

        # Halfway through month (15 days left out of 30)
        today = date(2026, 5, 16)
        res = calculate_proration(sub, new_plan, today)
        self.assertEqual(res["days_remaining"], 15)
        self.assertEqual(res["total_days_in_cycle"], 30)
        self.assertEqual(res["unused_credit"], 500.0)      # 1000 * 15 / 30
        self.assertEqual(res["new_plan_charge"], 1500.0)   # 3000 * 15 / 30
        self.assertEqual(res["net_amount"], 1000.0)        # 1500 - 500


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

    def test_idempotent_webhook_processing(self):
        payload = {
            "invoice_id": self.inv.id,
            "transaction_id": "txn_unique_999",
            "amount": 2000.0,
        }
        res1 = process_webhook_event(self.db, "stripe", "payment_intent.succeeded", payload)
        self.assertEqual(res1["status"], "success")
        self.assertEqual(self.inv.status, "Paid")

        # Duplicate event with same transaction_id
        res2 = process_webhook_event(self.db, "stripe", "payment_intent.succeeded", payload)
        self.assertEqual(res2["status"], "duplicate")


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


if __name__ == "__main__":
    unittest.main()
