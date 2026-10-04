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


def get_alembic_config(db_url: str | None = None):
    """Builds an Alembic Config object pointing to the backend migrations directory."""
    from alembic.config import Config

    ini_path = os.path.join(CURRENT_DIR, "alembic.ini")
    cfg = Config(ini_path)
    cfg.set_main_option("script_location", os.path.join(CURRENT_DIR, "migrations"))
    target_url = db_url or DATABASE_URL
    cfg.set_main_option("sqlalchemy.url", target_url)
    return cfg


def run_migrations(db_url: str | None = None, target_revision: str = "head", connection=None):
    """
    Applies Alembic database migrations programmatically up to target_revision.
    Defaults to 'head'.
    """
    from alembic import command

    alembic_cfg = get_alembic_config(db_url)
    if connection is not None:
        alembic_cfg.attributes["connection"] = connection
    command.upgrade(alembic_cfg, target_revision)


def init_db(db_url: str | None = None, target_revision: str = "head"):
    """
    Initializes and versions the database using Alembic migrations.
    Replaces manual create_all() and ad-hoc ALTER TABLE PRAGMA statements.
    - If database is unversioned but already contains legacy tables, stamps to target_revision.
    - If database is fresh or already versioned, applies migrations up to target_revision.
    """
    import logging
    from alembic import command
    from sqlalchemy import inspect

    logger = logging.getLogger(__name__)
    active_engine = engine if db_url is None else create_engine(db_url, **engine_kwargs)

    try:
        alembic_cfg = get_alembic_config(db_url)

        with active_engine.begin() as conn:
            inspector = inspect(conn)
            table_names = set(inspector.get_table_names())

            has_alembic_table = "alembic_version" in table_names
            has_incidents_table = "incidents" in table_names

            if not has_alembic_table and has_incidents_table:
                # Existing database created before Alembic was introduced
                logger.info("Legacy unversioned database detected; stamping Alembic schema version to %s", target_revision)
                alembic_cfg.attributes["connection"] = conn
                command.stamp(alembic_cfg, target_revision)
            else:
                # Fresh database or versioned database: run migration upgrade
                alembic_cfg.attributes["connection"] = conn
                command.upgrade(alembic_cfg, target_revision)

    except Exception as e:
        logger.error("Alembic migration failed during init_db: %s", e, exc_info=True)
        # Fallback to create_all if migration encounters an unexpected error
        import models  # noqa: F401
        Base.metadata.create_all(bind=active_engine)


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
