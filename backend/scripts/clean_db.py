"""
clean_db.py - SentinelOps Database Reset Script
Wipes all default, mock, seed, and test data from both SQLite (sentinelops.db)
and cloud MongoDB Atlas collections, ensuring a 100% clean operational slate.
"""

import os
import sys

# Set UTF-8 encoding for standard output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db, init_db
from models import (
    AIAnalysis,
    Approval,
    Incident,
    PipelineJob,
    PullRequest,
    Remediation,
    Repository,
    WorkflowRun,
)
from services.mongo_service import mongo_service


def clean_sqlite():
    print("[SQLite] Initializing database tables...")
    init_db()
    with get_db() as db:
        inc_count = db.query(Incident).count()
        wf_count = db.query(WorkflowRun).count()

        print(f"   Found {inc_count} incidents, {wf_count} workflow runs.")

        db.query(Approval).delete()
        db.query(PullRequest).delete()
        db.query(Remediation).delete()
        db.query(AIAnalysis).delete()
        db.query(Incident).delete()
        db.query(PipelineJob).delete()
        db.query(WorkflowRun).delete()
        db.query(Repository).delete()
        db.commit()

    print("[SQLite] Cleaned all rows successfully.")


def clean_mongodb():
    print("[MongoDB Atlas] Connecting to cluster...")
    if not mongo_service.is_connected():
        print("[MongoDB Atlas] Not connected. Attempting connection...")
    
    if mongo_service._db is not None:
        collections = [
            "incidents",
            "workflows",
            "agent_reasoning",
            "audit_logs",
            "logs",
            "deployments",
            "rollbacks",
            "approvals",
            "github_actions",
        ]
        total_deleted = 0
        for col_name in collections:
            col = mongo_service._db[col_name]
            count = col.count_documents({})
            if count > 0:
                res = col.delete_many({})
                print(f"   Deleted {res.deleted_count} documents from '{col_name}'")
                total_deleted += res.deleted_count
            else:
                print(f"   Collection '{col_name}' is already empty.")

        print(f"[MongoDB Atlas] Total {total_deleted} documents deleted across collections.")
    else:
        print("[MongoDB Atlas] Database handle not available, skipping.")


if __name__ == "__main__":
    print("=" * 60)
    print(" SentinelOps Clean Database Utility")
    print("=" * 60)
    clean_sqlite()
    print("-" * 60)
    clean_mongodb()
    print("=" * 60)
    print("Database reset completed! SentinelOps is running completely clean.")
    print("=" * 60)
