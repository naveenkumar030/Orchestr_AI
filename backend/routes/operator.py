"""
Operator & Cryptographic Signatures Blueprint for SentinelOps.
Handles operator identity clearance, hardware keys (Cosign/YubiKey),
immutable audit logs, and compliance report exports.
"""

from flask import Blueprint, jsonify, request, Response
from services.operator_service import operator_service
import json

operator_bp = Blueprint("operator", __name__)


@operator_bp.route("/api/operator/profile", methods=["GET"])
def get_operator_profile():
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1")
    user_agent = request.headers.get("User-Agent", "")
    profile = operator_service.get_profile(client_ip=client_ip, user_agent=user_agent)
    return jsonify(profile), 200


@operator_bp.route("/api/operator/signatures", methods=["GET"])
@operator_bp.route("/api/audit-logs", methods=["GET"])
def get_operator_signatures():
    limit = int(request.args.get("limit", 50))
    signatures = operator_service.get_signatures(limit=limit)
    return jsonify({
        "signatures": signatures,
        "count": len(signatures),
        "sequence": operator_service._audit_sequence,
    }), 200


@operator_bp.route("/api/operator/signatures", methods=["POST"])
def create_operator_signature():
    data = request.get_json(force=True, silent=True) or {}
    action = data.get("action")
    details = data.get("details", "")
    sig_type = data.get("type", "operator_action")
    token_type = data.get("token_type", "YubiKey 5C NFC (Cosign ECDSA-P256)")

    if not action:
        return jsonify({"error": "Missing 'action' in signature payload"}), 400

    entry = operator_service.record_signature(
        action=action,
        details=details,
        sig_type=sig_type,
        token_type=token_type,
        metadata=data.get("metadata", {}),
    )
    return jsonify({"success": True, "signature": entry}), 201


@operator_bp.route("/api/operator/keys/rotate-cosign", methods=["POST"])
def rotate_cosign_key():
    data = request.get_json(force=True, silent=True) or {}
    worker = data.get("worker", "Production Node Worker 01")
    result = operator_service.rotate_cosign_key(worker_node=worker)
    return jsonify(result), 200


@operator_bp.route("/api/operator/keys/rotate-gpg", methods=["POST"])
def rotate_gpg_key():
    result = operator_service.rotate_gpg_key()
    return jsonify(result), 200


@operator_bp.route("/api/operator/audit-export", methods=["GET"])
def export_audit_log():
    export_data = operator_service.export_audit_log()
    format_type = request.args.get("format", "json")
    
    if format_type == "download":
        response = Response(
            json.dumps(export_data, indent=2),
            mimetype="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=sentinelops-audit-{export_data['export_id']}.json"
            }
        )
        return response

    return jsonify(export_data), 200
