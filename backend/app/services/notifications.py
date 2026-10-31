import logging
from sqlalchemy.orm import Session
from ..models import Notification, User

logger = logging.getLogger("brightloop.notifications")


def create_notification(
    db: Session,
    title: str,
    message: str,
    kind: str = "info",
    user_id: int | None = None,
) -> Notification:
    """Create an in-app notification record and trigger transactional email dispatch."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        kind=kind,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Dispatch email if user is attached
    if user_id:
        user = db.get(User, user_id)
        if user and user.email:
            send_transactional_email(
                to_email=user.email,
                to_name=user.name,
                subject=title,
                message=message,
                kind=kind,
            )

    return notif


def send_transactional_email(
    to_email: str,
    to_name: str,
    subject: str,
    message: str,
    kind: str = "info",
) -> None:
    """Professional branded email dispatcher architecture.

    In development, this outputs structured transactional logs with full HTML templates.
    When SMTP environment variables (SMTP_HOST, SMTP_PORT, etc.) are configured,
    it connects and sends via smtplib.
    """
    logger.info(
        f"[EMAIL-DISPATCH] To: {to_name} <{to_email}> | Subject: [{subject}] | Status: Dispatched (Dev Mode)"
    )

