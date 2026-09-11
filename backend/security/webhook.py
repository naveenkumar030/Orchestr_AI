"""
Webhook security and signature verification for SentinelOps.
Validates HMAC SHA-256 signatures for incoming GitHub webhooks.
"""

import os
import hmac
import hashlib


def verify_github_signature(payload_bytes: bytes, signature_header: str, secret: str = None) -> tuple[bool, str]:
    """
    Validates the GitHub Webhook HMAC SHA-256 signature against the configured secret.

    :param payload_bytes: Raw request body as bytes.
    :param signature_header: The value of the 'X-Hub-Signature-256' header.
    :param secret: Webhook secret. If None, reads from GITHUB_WEBHOOK_SECRET environment variable.
    :return: (is_valid: bool, message: str)
    """
    if secret is None:
        secret = os.environ.get("GITHUB_WEBHOOK_SECRET")

    # In local development mode without a secret configured, allow permissive processing
    if not secret:
        return True, "No secret configured (local dev mode)"

    if not signature_header:
        return False, "Missing X-Hub-Signature-256 header"

    if not signature_header.startswith("sha256="):
        return False, "Malformed signature header (expected 'sha256=' prefix)"

    expected_hash = hmac.new(
        secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

    received_hash = signature_header[len("sha256="):]

    if not hmac.compare_digest(expected_hash, received_hash):
        return False, "Invalid HMAC SHA-256 signature"

    return True, "Signature verified"
