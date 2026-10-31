from datetime import date
from ..models import Subscription, Plan


def calculate_proration(
    sub: Subscription,
    new_plan: Plan,
    today: date,
) -> dict:
    """Calculate the prorated credit/charge when transitioning between plans.

    Returns:
        {
            "days_remaining": int,
            "total_days_in_cycle": int,
            "unused_credit": float,
            "new_plan_charge": float,
            "net_amount": float,  # > 0 means customer pays difference; < 0 means credit balance
            "summary": str
        }
    """
    cycle_start = sub.start_date
    cycle_end = sub.next_billing_date or today

    total_days = max(1, (cycle_end - cycle_start).days)
    days_remaining = max(0, (cycle_end - today).days)

    if days_remaining <= 0 or total_days <= 0:
        return {
            "days_remaining": 0,
            "total_days_in_cycle": total_days,
            "unused_credit": 0.0,
            "new_plan_charge": round(new_plan.price * sub.quantity, 2),
            "net_amount": round(new_plan.price * sub.quantity, 2),
            "summary": "Full cycle billing applies."
        }

    # Unused value of the old plan
    daily_rate_old = (sub.unit_price * sub.quantity) / total_days
    unused_credit = round(daily_rate_old * days_remaining, 2)

    # Cost of the new plan for the remainder of this cycle
    daily_rate_new = (new_plan.price * sub.quantity) / total_days
    new_plan_charge = round(daily_rate_new * days_remaining, 2)

    net_amount = round(new_plan_charge - unused_credit, 2)

    summary = (
        f"Prorated {days_remaining}/{total_days} days. "
        f"Unused credit: ₹{unused_credit:,.2f}, New charge: ₹{new_plan_charge:,.2f}. "
        f"Net difference: ₹{net_amount:,.2f}"
    )

    return {
        "days_remaining": days_remaining,
        "total_days_in_cycle": total_days,
        "unused_credit": unused_credit,
        "new_plan_charge": new_plan_charge,
        "net_amount": net_amount,
        "summary": summary,
    }

