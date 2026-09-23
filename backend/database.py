"""
Database configuration and session management for SentinelOps.
Supports PostgreSQL (production) with automatic local SQLite fallback.
"""

import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, scoped_session, sessionmaker

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

# Connection arguments for SQLite and Cloud PostgreSQL (Render/Neon/Supabase)
engine_kwargs = {"echo": False}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = scoped_session(
    sessionmaker(autocommit=False, autoflush=False, bind=engine)
)

Base = declarative_base()


def init_db():
    """Initializes all database tables registered with Base metadata."""
    import models  # noqa: F401 - ensures all models are imported before create_all
    Base.metadata.create_all(bind=engine)

    # SQLite schema auto-migration for newly added columns
    if str(engine.url).startswith("sqlite"):
        try:
            with engine.connect() as conn:
                res = conn.exec_driver_sql("PRAGMA table_info(incidents)").fetchall()
                existing_cols = {row[1] for row in res}
                cols_to_add = {
                    "prNumber": "INTEGER",
                    "prUrl": "VARCHAR(512)",
                    "remediationBranch": "VARCHAR(256)",
                    "diff": "TEXT",
                    "agent_reasoning": "TEXT",
                    "source": "VARCHAR(32) DEFAULT 'webhook'",
                }
                for col_name, col_type in cols_to_add.items():
                    if col_name not in existing_cols:
                        conn.exec_driver_sql(f"ALTER TABLE incidents ADD COLUMN {col_name} {col_type}")
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Failed to migrate SQLite schema: %s", e, exc_info=True)


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
