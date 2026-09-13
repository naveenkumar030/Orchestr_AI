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

# ── Slack Notifications ──────────────────────────────────────────────────────
SLACK_WEBHOOK_URL: str | None = os.environ.get("SLACK_WEBHOOK_URL")

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
ALLOWED_PATHS: str = os.environ.get("ALLOWED_PATHS", "src/*,app/*,tests/*,migrations/*,db/*,*.py,*.js,*.ts,*.json,*.txt,*.md,*.html,*.css,*.sql,*.yml,*.yaml,*.sh")
BLOCKED_PATHS: str = os.environ.get("BLOCKED_PATHS", ".env*,.github/workflows/*,.github/actions/*,terraform/*,kubernetes/*,secrets/*,credentials/*,*.pem,*.key")
MAX_FILES_CHANGED: int = int(os.environ.get("MAX_FILES_CHANGED", 10))
MAX_LINES_CHANGED: int = int(os.environ.get("MAX_LINES_CHANGED", 500))
REQUIRE_HUMAN_APPROVAL: bool = os.environ.get("REQUIRE_HUMAN_APPROVAL", "True").lower() == "true"

# ── Phase 2 Autonomous Loop & Validation Settings ─────────────────────────────
MAX_REMEDIATION_ATTEMPTS: int = int(os.environ.get("MAX_REMEDIATION_ATTEMPTS", 3))
CI_VALIDATION_TIMEOUT_SECONDS: int = int(os.environ.get("CI_VALIDATION_TIMEOUT_SECONDS", 600))
CI_POLL_INTERVAL_SECONDS: int = int(os.environ.get("CI_POLL_INTERVAL_SECONDS", 10))
AUTO_MERGE_ENABLED: bool = os.environ.get("AUTO_MERGE_ENABLED", "True").lower() == "true"

# ── Phase 3 Autonomous Deployment Verification & Rollback Settings ───────────
HEALTH_CHECK_ENABLED: bool = os.environ.get("HEALTH_CHECK_ENABLED", "True").lower() == "true"
HEALTH_CHECK_URL: str | None = os.environ.get("HEALTH_CHECK_URL")
HEALTH_CHECK_TIMEOUT_SECONDS: int = int(os.environ.get("HEALTH_CHECK_TIMEOUT_SECONDS", 120))
HEALTH_CHECK_INTERVAL_SECONDS: int = int(os.environ.get("HEALTH_CHECK_INTERVAL_SECONDS", 5))
HEALTH_CHECK_SUCCESS_THRESHOLD: int = int(os.environ.get("HEALTH_CHECK_SUCCESS_THRESHOLD", 2))
MAX_ROLLBACK_ATTEMPTS: int = int(os.environ.get("MAX_ROLLBACK_ATTEMPTS", 1))
DEPLOYMENT_PROVIDER: str = os.environ.get("DEPLOYMENT_PROVIDER", "github_actions")
DEPLOYMENT_TIMEOUT_SECONDS: int = int(os.environ.get("DEPLOYMENT_TIMEOUT_SECONDS", 300))

# ── Phase 6 Reliability, Resilience & Cost Control Settings ───────────────────
SENTINEL_PRIMARY_LLM: str = os.environ.get("SENTINEL_PRIMARY_LLM", "groq").lower()
SENTINEL_FALLBACK_LLM: str = os.environ.get("SENTINEL_FALLBACK_LLM", "gemini").lower()
SENTINEL_OLLAMA_ENABLED: bool = os.environ.get("SENTINEL_OLLAMA_ENABLED", "False").lower() == "true"
SENTINEL_OLLAMA_HOST: str = os.environ.get("SENTINEL_OLLAMA_HOST", "http://127.0.0.1:11434")
SENTINEL_OLLAMA_MODEL: str = os.environ.get("SENTINEL_OLLAMA_MODEL", "llama3.2:latest")

SENTINEL_LLM_MAX_RETRIES: int = int(os.environ.get("SENTINEL_LLM_MAX_RETRIES", 3))
SENTINEL_LLM_RETRY_BASE_DELAY: float = float(os.environ.get("SENTINEL_LLM_RETRY_BASE_DELAY", 1.0))
SENTINEL_LLM_MAX_BACKOFF_SECONDS: float = float(os.environ.get("SENTINEL_LLM_MAX_BACKOFF_SECONDS", 10.0))

SENTINEL_DIAGNOSIS_CACHE_TTL: int = int(os.environ.get("SENTINEL_DIAGNOSIS_CACHE_TTL", 86400))  # 24 hours default
SENTINEL_DIAGNOSIS_CACHE_ENABLED: bool = os.environ.get("SENTINEL_DIAGNOSIS_CACHE_ENABLED", "True").lower() == "true"

SENTINEL_PROVIDER_FAILURE_THRESHOLD: int = int(os.environ.get("SENTINEL_PROVIDER_FAILURE_THRESHOLD", 3))
SENTINEL_PROVIDER_COOLDOWN: int = int(os.environ.get("SENTINEL_PROVIDER_COOLDOWN", 60))

SENTINEL_GITHUB_TIMEOUT: int = int(os.environ.get("SENTINEL_GITHUB_TIMEOUT", 30))
SENTINEL_LLM_TIMEOUT: int = int(os.environ.get("SENTINEL_LLM_TIMEOUT", 30))
SENTINEL_SLACK_TIMEOUT: int = int(os.environ.get("SENTINEL_SLACK_TIMEOUT", 10))
SENTINEL_AGENT_TIMEOUT_SECONDS: int = int(os.environ.get("SENTINEL_AGENT_TIMEOUT_SECONDS", 60))

# Config class alias for class-based attribute access
class Config:
    """Config container providing class-level attribute access."""
    pass

for _attr, _val in list(globals().items()):
    if not _attr.startswith("_") and _attr != "Config":
        setattr(Config, _attr, _val)
