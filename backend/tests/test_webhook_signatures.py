import hashlib
import hmac
import os
import sys
from unittest.mock import patch

# Ensure backend directory is in python search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from security.webhook import verify_github_signature


def test_verify_signature_missing_secret_fails_closed():
    with patch("os.environ.get", return_value=None):
        with patch("config.Config.WEBHOOK_PERMISSIVE_DEV", False, create=True):
            is_valid, msg = verify_github_signature(b"payload", "sha256=123", secret=None)
            assert is_valid is False
            assert msg == "Missing GITHUB_WEBHOOK_SECRET in configuration"


def test_verify_signature_missing_secret_permissive_mode():
    with patch("os.environ.get", return_value=None):
        with patch("config.Config.WEBHOOK_PERMISSIVE_DEV", True, create=True):
            is_valid, msg = verify_github_signature(b"payload", "sha256=123", secret=None)
            assert is_valid is True
            assert msg == "No secret configured (permissive dev mode)"


def test_verify_signature_missing_header():
    is_valid, msg = verify_github_signature(b"payload", None, secret="my-secret")
    assert is_valid is False
    assert msg == "Missing X-Hub-Signature-256 header"


def test_verify_signature_invalid_header_format():
    is_valid, msg = verify_github_signature(b"payload", "invalid_format=123", secret="my-secret")
    assert is_valid is False
    assert msg == "Malformed signature header (expected 'sha256=' prefix)"


def test_verify_signature_invalid_signature():
    is_valid, msg = verify_github_signature(b"payload", "sha256=1234567890abcdef", secret="my-secret")
    assert is_valid is False
    assert msg == "Invalid HMAC SHA-256 signature"


def test_verify_signature_valid():
    secret = "my-secret"
    payload = b'{"hello": "world"}'
    expected_hash = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    header = f"sha256={expected_hash}"
    is_valid, msg = verify_github_signature(payload, header, secret=secret)
    assert is_valid is True
    assert msg == "Signature verified"
