from datetime import date, datetime
from decimal import Decimal


def serialize(obj, extra: dict | None = None) -> dict:
    """Serialize a SQLAlchemy model instance to a JSON-safe dict.

    Handles date/datetime (ISO string), Decimal (float), and plain scalars.
    Pass ``extra`` to merge additional computed fields into the result.
    """
    data: dict = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, (date, datetime)):
            data[col.name] = val.isoformat()
        elif isinstance(val, Decimal):
            data[col.name] = float(val)
        else:
            data[col.name] = val
    if extra:
        data.update(extra)
    return data

