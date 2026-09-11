"""
Health & Overview Blueprint for SentinelOps.
Handles /api/health and /api/overview routes.
"""

from flask import Blueprint, jsonify
from data_store import store

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/health", methods=["GET"])
def health_check():
    return jsonify(store.get_health()), 200


@health_bp.route("/api/overview", methods=["GET"])
def get_overview():
    return jsonify(store.get_overview()), 200
