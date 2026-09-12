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
                    _val = _v.strip().strip("'\"")
                    if _val:
                        os.environ[_k.strip()] = _val
    except Exception:
        pass

# ── GitHub Integration ────────────────────────────────────────────────────────
GITHUB_WEBHOOK_SECRET: str | None = os.environ.get("GITHUB_WEBHOOK_SECRET")
GITHUB_TOKEN: str | None = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO: str = os.environ.get("GITHUB_REPO", "naveenkumar030/SentinelOps")

# ── AI Model & Provider Integrations ──────────────────────────────────────────
OPENAI_API_KEY: str | None = os.environ.get("OPENAI_API_KEY")
GROQ_API_KEY: str | None = os.environ.get("GROQ_API_KEY")
GEMINI_API_KEY: str | None = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
GOOGLE_API_KEY: str | None = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")





# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL: str | None = os.environ.get("DATABASE_URL")

# ── Server ────────────────────────────────────────────────────────────────────
HOST: str = os.environ.get("HOST", "0.0.0.0")
PORT: int = int(os.environ.get("PORT", 5000))

# ── Feature Flags ─────────────────────────────────────────────────────────────
# Set to "true" to allow webhook processing without a configured secret (dev only)
WEBHOOK_PERMISSIVE_DEV: bool = not bool(GITHUB_WEBHOOK_SECRET)

# ── SentinelGuard Policies ────────────────────────────────────────────────────
PROTECTED_BRANCHES: str = os.environ.get("PROTECTED_BRANCHES", "main,master,production,prod")
ALLOWED_PATHS: str = os.environ.get("ALLOWED_PATHS", "src/*,app/*,tests/*,*.py,*.js,*.ts,*.json,*.txt,*.md,*.html,*.css")
BLOCKED_PATHS: str = os.environ.get("BLOCKED_PATHS", ".env*,.github/workflows/*,.github/actions/*,terraform/*,kubernetes/*,secrets/*,credentials/*,*.pem,*.key")
MAX_FILES_CHANGED: int = int(os.environ.get("MAX_FILES_CHANGED", 10))
MAX_LINES_CHANGED: int = int(os.environ.get("MAX_LINES_CHANGED", 500))
REQUIRE_HUMAN_APPROVAL: bool = os.environ.get("REQUIRE_HUMAN_APPROVAL", "True").lower() == "true"
