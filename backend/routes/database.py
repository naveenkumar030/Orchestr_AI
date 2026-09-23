"""
Database Management & Diagnostics Blueprint for SentinelOps.
Provides real-time telemetry, connectivity verification, and synchronization
for MongoDB Atlas and SQLite persistence layers.
"""

from data_store import store
from flask import Blueprint, jsonify
from services.mongo_service import mongo_service

database_bp = Blueprint("database", __name__)


@database_bp.route("/api/database/status", methods=["GET"])
def get_database_status():
    """
    Returns live database diagnostic telemetry including connection state,
    provider, active database, latency, and collection document counts.
    """
    is_connected = mongo_service.is_connected()
    stats = mongo_service.get_stats()
    
    return jsonify({
        "status": "connected" if is_connected else "disconnected",
        "provider": "MongoDB Atlas" if is_connected else "Local SQLite Fallback",
        "database": mongo_service._db_name,
        "connected": is_connected,
        "configured": bool(mongo_service._uri),
        "latency_ms": mongo_service._last_ping_latency,
        "last_ping_time": mongo_service._last_ping_time,
        "collections": stats.get("collections", {}),
    }), 200


@database_bp.route("/api/database/ping", methods=["POST", "GET"])
def ping_database():
    """
    Executes an active administrative ping directly against MongoDB Atlas
    to measure real-time round-trip latency.
    """
    ping_result = mongo_service.ping()
    status_code = 200 if ping_result.get("ok") == 1 else 503
    return jsonify(ping_result), status_code


@database_bp.route("/api/database/sync", methods=["POST"])
def sync_database_state():
    """
    Synchronizes in-memory operational state (settings, incidents, deployments, rollbacks)
    to MongoDB Atlas on demand.
    """
    if not mongo_service.is_connected():
        return jsonify({
            "success": False,
            "error": "MongoDB Atlas is not connected or unreachable",
        }), 503

    synced_items = {
        "settings": False,
        "incidents_synced": 0,
        "deployments_synced": 0,
        "rollbacks_synced": 0,
    }

    try:
        # 1. Sync Settings
        mongo_service.save_settings(store.settings)
        synced_items["settings"] = True

        # 2. Sync Incidents from incident_service / store
        incs = store.get_incidents()
        for inc in incs:
            if inc.get("id"):
                mongo_service.upsert_incident(inc)
                synced_items["incidents_synced"] += 1

        # 3. Sync Deployments
        for dep in store.deployments:
            mongo_service.save_deployment(dep)
            synced_items["deployments_synced"] += 1

        # 4. Sync Rollbacks
        for rb in store.rollbacks:
            mongo_service.save_rollback(rb)
            synced_items["rollbacks_synced"] += 1

        stats = mongo_service.get_stats()
        return jsonify({
            "success": True,
            "message": "Operational state successfully synchronized to MongoDB Atlas",
            "synced": synced_items,
            "stats": stats,
        }), 200
    except Exception as ex:
        return jsonify({
            "success": False,
            "error": f"State sync failed: {ex!s}",
        }), 500
