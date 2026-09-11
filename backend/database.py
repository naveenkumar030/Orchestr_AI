"""
Database configuration and session management for SentinelOps.
Supports PostgreSQL (production) with automatic local SQLite fallback.
"""

import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_PATH = os.path.join(CURRENT_DIR, "sentinelops.db")

# Read DATABASE_URL or default to SQLite
raw_db_url = os.environ.get("DATABASE_URL")
if raw_db_url:
    # Standardize legacy postgres:// schemas to postgresql://
    if raw_db_url.startswith("postgres://"):
        DATABASE_URL = raw_db_url.replace("postgres://", "postgresql://", 1)
    else:
        DATABASE_URL = raw_db_url
else:
    DATABASE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"

# Connection arguments for SQLite
engine_kwargs = {"echo": False}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = scoped_session(
    sessionmaker(autocommit=False, autoflush=False, bind=engine)
)

Base = declarative_base()


def init_db():
    """Initializes all database tables registered with Base metadata."""
    import models  # noqa: F401 - ensures all models are imported before create_all
    Base.metadata.create_all(bind=engine)


@contextmanager
def get_db():
    """Context manager for scoped database sessions."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
