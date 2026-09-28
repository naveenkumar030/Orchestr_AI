import os
import subprocess
import sys
import pytest

import config


def test_dev_mode_uses_fallback_when_secret_unset():
    """In development mode with no secret provided, the dev fallback key is used."""
    secret = config._resolve_secret_key(raw_secret=None, is_production=False)
    assert secret == config._DEV_SECRET_FALLBACK


def test_dev_mode_uses_custom_secret_when_provided():
    """In development mode, an explicitly provided secret is used."""
    custom = "custom-local-secret-key"
    secret = config._resolve_secret_key(raw_secret=custom, is_production=False)
    assert secret == custom


def test_production_fails_when_secret_is_missing():
    """In production mode, missing secret key must raise RuntimeError and fail startup."""
    with pytest.raises(RuntimeError, match="must be configured in production"):
        config._resolve_secret_key(raw_secret=None, is_production=True)

    with pytest.raises(RuntimeError, match="must be configured in production"):
        config._resolve_secret_key(raw_secret="", is_production=True)

    with pytest.raises(RuntimeError, match="must be configured in production"):
        config._resolve_secret_key(raw_secret="   ", is_production=True)


def test_production_fails_when_secret_is_known_insecure_fallback():
    """In production mode, the known development fallback must raise RuntimeError."""
    with pytest.raises(RuntimeError, match="weak or default SECRET_KEY"):
        config._resolve_secret_key(
            raw_secret=config._DEV_SECRET_FALLBACK,
            is_production=True,
        )

    for weak in ["secret", "changeme", "dev", "development", "password"]:
        with pytest.raises(RuntimeError, match="weak or default SECRET_KEY"):
            config._resolve_secret_key(raw_secret=weak, is_production=True)


def test_production_fails_when_secret_is_too_short():
    """In production mode, a secret shorter than 16 characters must be rejected."""
    with pytest.raises(RuntimeError, match="at least 16 characters"):
        config._resolve_secret_key(raw_secret="short-sec-1234", is_production=True)


def test_production_succeeds_with_strong_secret():
    """In production mode, a strong secret key (>= 16 chars) must succeed."""
    strong_key = "a" * 32
    secret = config._resolve_secret_key(raw_secret=strong_key, is_production=True)
    assert secret == strong_key


def test_production_startup_fails_without_secret():
    """Starting up in production without secret key must fail with RuntimeError."""
    cmd = [
        sys.executable,
        "-c",
        "import config",
    ]
    env = os.environ.copy()
    backend_dir = os.path.dirname(os.path.abspath(config.__file__))
    env["PYTHONPATH"] = backend_dir
    env["FLASK_ENV"] = "production"
    env.pop("SECRET_KEY", None)
    env.pop("FLASK_SECRET_KEY", None)

    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    assert res.returncode != 0
    assert "CRITICAL SECURITY CONFIGURATION ERROR" in res.stderr
    assert "must be configured in production" in res.stderr


def test_production_startup_succeeds_with_strong_secret():
    """Starting up in production with a strong secret key must succeed."""
    cmd = [
        sys.executable,
        "-c",
        "import config; assert config.SECRET_KEY == 'super-secret-production-key-99999999'",
    ]
    env = os.environ.copy()
    backend_dir = os.path.dirname(os.path.abspath(config.__file__))
    env["PYTHONPATH"] = backend_dir
    env["FLASK_ENV"] = "production"
    env["SECRET_KEY"] = "super-secret-production-key-99999999"

    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    assert res.returncode == 0, res.stderr
