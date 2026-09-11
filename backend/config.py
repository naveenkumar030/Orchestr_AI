"""
SentinelOps Configuration
Centralises all environment-variable reads so routes and services
never call os.environ.get() directly.
"""

import os

# Load .env file if present
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_env_path):
    try:
        with open(_env_path, "r", encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    os.environ.setdefault(_k.strip(), _v.strip().strip("'\""))
    except Exception:
        pass

# ── GitHub Integration ────────────────────────────────────────────────────────
GITHUB_WEBHOOK_SECRET: str | None = os.environ.get("GITHUB_WEBHOOK_SECRET")
GITHUB_TOKEN: str | None = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO: str = os.environ.get("GITHUB_REPO", "naveenkumar030/SentinelOps")

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL: str | None = os.environ.get("DATABASE_URL")

# ── Server ────────────────────────────────────────────────────────────────────
HOST: str = os.environ.get("HOST", "0.0.0.0")
PORT: int = int(os.environ.get("PORT", 5000))

# ── Feature Flags ─────────────────────────────────────────────────────────────
# Set to "true" to allow webhook processing without a configured secret (dev only)
WEBHOOK_PERMISSIVE_DEV: bool = not bool(GITHUB_WEBHOOK_SECRET)
