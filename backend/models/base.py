"""
Base model utilities, mixins, and serialization helpers for SentinelOps models.
"""

from datetime import datetime
from database import Base


class TimestampMixin:
    """Provides created_at and updated_at timestamps."""
    pass


class SerializerMixin:
    """Helper to serialize SQLAlchemy models to Python dictionaries."""

    def to_dict(self):
        result = {}
        for col in self.__table__.columns:
            val = getattr(self, col.name)
            if isinstance(val, datetime):
                val = val.isoformat()
            result[col.name] = val
        return result
