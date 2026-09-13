"""
Secret Sanitizer for SentinelOps Multi-Agent System.
Ensures zero secrets, credentials, tokens, private keys, or sensitive environment
files are leaked to LLMs or stored insecurely.
"""

import re
from typing import Dict, Any, List, Optional

# Regex patterns for high-entropy secrets and known provider keys
SECRET_PATTERNS = [
    # GitHub Personal Access Tokens & App Tokens
    (re.compile(r"ghp_[a-zA-Z0-9]{20,}", re.IGNORECASE), "[REDACTED_GITHUB_PAT]"),
    (re.compile(r"gho_[a-zA-Z0-9]{20,}", re.IGNORECASE), "[REDACTED_GITHUB_OAUTH]"),
    (re.compile(r"ghu_[a-zA-Z0-9]{20,}", re.IGNORECASE), "[REDACTED_GITHUB_USER]"),
    (re.compile(r"ghs_[a-zA-Z0-9]{20,}", re.IGNORECASE), "[REDACTED_GITHUB_SERVER]"),
    (re.compile(r"ghr_[a-zA-Z0-9]{20,}", re.IGNORECASE), "[REDACTED_GITHUB_REFRESH]"),
    (re.compile(r"github_pat_[a-zA-Z0-9_]{20,}", re.IGNORECASE), "[REDACTED_GITHUB_PAT_FINE_GRAINED]"),

    # Stripe API Keys
    (re.compile(r"sk_live_[a-zA-Z0-9_\-]{20,}", re.IGNORECASE), "[REDACTED_STRIPE_KEY]"),
    (re.compile(r"sk_test_[a-zA-Z0-9_\-]{20,}", re.IGNORECASE), "[REDACTED_STRIPE_KEY]"),
    (re.compile(r"rk_live_[a-zA-Z0-9_\-]{20,}", re.IGNORECASE), "[REDACTED_STRIPE_KEY]"),

    # OpenAI API Keys
    (re.compile(r"sk-[a-zA-Z0-9_\-]{20,}", re.IGNORECASE), "[REDACTED_OPENAI_KEY]"),

    # Google / Gemini API Keys
    (re.compile(r"AIza[0-9A-Za-z\-_]{35}", re.IGNORECASE), "[REDACTED_GOOGLE_API_KEY]"),

    # Groq API Keys
    (re.compile(r"gsk_[a-zA-Z0-9]{20,}", re.IGNORECASE), "[REDACTED_GROQ_KEY]"),

    # AWS Access Key ID & Secret Key
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED_AWS_ACCESS_KEY]"),
    (re.compile(r"(?i)aws_secret_access_key\s*=\s*['\"][A-Za-z0-9/+=]{40}['\"]"), "aws_secret_access_key=[REDACTED_AWS_SECRET]"),

    # Slack Tokens & Webhooks
    (re.compile(r"xox[baprs]-[0-9a-zA-Z\-]{10,}", re.IGNORECASE), "[REDACTED_SLACK_TOKEN]"),
    (re.compile(r"https://hooks\.slack\.com/services/[A-Za-z0-9]+/[A-Za-z0-9]+/[A-Za-z0-9]+"), "[REDACTED_SLACK_WEBHOOK]"),

    # Private Keys (PEM / PKCS8 / OpenSSH)
    (re.compile(r"-----BEGIN [A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END [A-Z\s]+PRIVATE KEY-----"), "[REDACTED_PRIVATE_KEY]"),
    (re.compile(r"-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----"), "[REDACTED_PRIVATE_KEY]"),

    # Generic Authorization / Bearer tokens
    (re.compile(r"(?i)bearer\s+[a-zA-Z0-9_\-\.]{20,}"), "Bearer [REDACTED_BEARER_TOKEN]"),

    # Generic Password / Secret key-value assignments
    (re.compile(r"(?i)(password|secret|api_key|apikey|auth_token|client_secret)\s*[:=]\s*['\"][^'\"\s]{6,}['\"]"), r"\1=[REDACTED_SECRET]"),
]

# Sensitive file patterns that must never be ingested or sent to LLMs
SENSITIVE_FILE_PATTERNS = [
    re.compile(r"(^|/)\.env(\.[a-zA-Z0-9_-]+)?$", re.IGNORECASE),
    re.compile(r"(^|/).*\.pem$", re.IGNORECASE),
    re.compile(r"(^|/).*\.key$", re.IGNORECASE),
    re.compile(r"(^|/).*\.p12$", re.IGNORECASE),
    re.compile(r"(^|/).*\.pfx$", re.IGNORECASE),
    re.compile(r"(^|/)id_rsa(\..*)?$", re.IGNORECASE),
    re.compile(r"(^|/)id_ed25519(\..*)?$", re.IGNORECASE),
    re.compile(r"(^|/)credentials(\.json|\.yaml|\.yml)?$", re.IGNORECASE),
    re.compile(r"(^|/)secrets(\.json|\.yaml|\.yml)?$", re.IGNORECASE),
    re.compile(r"(^|/)service[_-]account(\.json)?$", re.IGNORECASE),
    re.compile(r"(^|/).*terraform\.tfvars.*$", re.IGNORECASE),
    re.compile(r"(^|/).*\.tfstate(\..*)?$", re.IGNORECASE),
]


class SecretSanitizer:
    """
    Sanitizes strings, log streams, and file maps to prevent secret leakage.
    """

    @staticmethod
    def sanitize_text(text: Optional[str]) -> str:
        """
        Replaces all detected secrets in the input text with descriptive redaction tags.
        """
        if not text:
            return ""

        sanitized = text
        for pattern, replacement in SECRET_PATTERNS:
            sanitized = pattern.sub(replacement, sanitized)

        return sanitized

    @staticmethod
    def is_sensitive_file(filename: str) -> bool:
        """
        Returns True if the file name/path matches known secret or credential file patterns.
        """
        if not filename:
            return False

        normalized = filename.replace("\\", "/").strip()
        for pattern in SENSITIVE_FILE_PATTERNS:
            if pattern.search(normalized):
                return True
        return False

    @classmethod
    def sanitize_repo_context(cls, files_map: Dict[str, str]) -> Dict[str, str]:
        """
        Filters out sensitive files and redacts secrets inside allowable files.
        """
        safe_context: Dict[str, str] = {}
        for path, content in files_map.items():
            if cls.is_sensitive_file(path):
                continue
            safe_context[path] = cls.sanitize_text(content)
        return safe_context


secret_sanitizer = SecretSanitizer()
