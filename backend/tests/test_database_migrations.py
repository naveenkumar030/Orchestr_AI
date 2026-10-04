import sqlite3

from database import init_db


def test_init_db_applies_head_migrations(tmp_path):
    db_path = tmp_path / "sentinelops-test.db"
    init_db(db_url=f"sqlite:///{db_path}")

    con = sqlite3.connect(db_path)
    try:
        incident_columns = {row[1] for row in con.execute("PRAGMA table_info(incidents)")}
        assert "prNumber" in incident_columns
        assert con.execute("SELECT version_num FROM alembic_version").fetchone() is not None
    finally:
        con.close()
