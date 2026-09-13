"""
Deterministic Error-Signature Generator for SentinelOps (Phase 6).
Generates canonical, normalized SHA-256 signatures for CI failure logs and errors.

Guarantees:
1. Excludes timestamps, run IDs, process IDs, memory addresses, and ephemeral secrets.
2. Normalizes whitespace, paths, line numbers, and variable error prefixes.
3. Produces consistent hashes across identical repeated CI failures.
"""

import re
import hashlib
from typing import Optional, Dict, Any
from services.secret_sanitizer import secret_sanitizer


class ErrorSignatureGenerator:
    """
    Generates deterministic error signatures for CI/CD failures to enable
    accurate diagnosis caching, deduplication, and anomaly tracking.
    """

    def __init__(self):
        # Regex patterns to strip variable runtime artifacts
        self._patterns = [
            # Memory addresses e.g. 0x7fff5fbff820 or 0x000001C8829A0B90
            (re.compile(r"0x[0-9a-fA-F]{6,16}"), "[MEM_ADDR]"),
            # Timestamps e.g. 2026-09-13T12:34:56.789Z or 2026-09-13 12:34:56
            (re.compile(r"\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?"), "[TIMESTAMP]"),
            # ISO time chunks e.g. 12:34:56.789
            (re.compile(r"\b\d{2}:\d{2}:\d{2}(\.\d+)?\b"), "[TIME]"),
            # Run IDs, Workflow Job IDs, and PID numbers e.g. run #892401, pid: 1249, job: 4918239012
            (re.compile(r"\b(run|job|workflow|task|pid|attempt)[_\s\-:#]+[0-9]{3,}\b", re.IGNORECASE), r"\1=[ID]"),
            # UUIDs e.g. 55047cc9-3f22-4ec3-8e38-5c35db73e394
            (re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"), "[UUID]"),
            # Line numbers e.g. line 45, :45:12, (test.py:120)
            (re.compile(r"(line\s+\d+|:\d+:\d+|:\d+\b|\.py:\d+|\.ts:\d+|\.js:\d+)"), "[LOC]"),
            # Ephemeral build / runner temp paths e.g. /home/runner/work/... or C:\Users\runner\...
            (re.compile(r"([a-zA-Z]:)?[\\/](home|Users|tmp|var|private|runner|work|AppData)[\\/][a-zA-Z0-9_\-\.\/\\~]+"), "[PATH]"),
            # Python object references e.g. <function foo at 0x...>
            (re.compile(r"<[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*(\s+object)?\s+at\s+\[MEM_ADDR\]>"), "[OBJ]"),
            # Multiple whitespace/newlines collapsed
            (re.compile(r"\s+"), " "),
        ]

    def normalize_text(self, text: Optional[str]) -> str:
        """Normalizes error text, strips dynamic artifacts, and sanitizes secrets."""
        if not text or not isinstance(text, str):
            return ""

        # Step 1: Secret Sanitization
        sanitized = secret_sanitizer.sanitize_text(text)

        # Step 2: Apply normalization patterns
        normalized = sanitized
        for pattern, replacement in self._patterns:
            normalized = pattern.sub(replacement, normalized)

        return normalized.strip().lower()

    def generate_signature(
        self,
        repository: str = "SentinelOps",
        workflow_name: Optional[str] = None,
        job_name: Optional[str] = None,
        failed_step: Optional[str] = None,
        category: Optional[str] = None,
        error_message: Optional[str] = None,
        stack_trace: Optional[str] = None,
    ) -> str:
        """
        Produces a canonical SHA-256 error signature hex digest.
        """
        norm_repo = self.normalize_text(repository or "sentinelops")
        norm_wf = self.normalize_text(workflow_name or "ci")
        norm_job = self.normalize_text(job_name or "build")
        norm_step = self.normalize_text(failed_step or "step")
        norm_cat = self.normalize_text(category or "unknown")
        norm_msg = self.normalize_text(error_message or "")
        norm_trace = self.normalize_text(stack_trace or "")

        # Key elements combined deterministically
        canonical_components = [
            f"repo:{norm_repo}",
            f"workflow:{norm_wf}",
            f"job:{norm_job}",
            f"step:{norm_step}",
            f"category:{norm_cat}",
            f"error:{norm_msg[:500]}",
            f"trace:{norm_trace[:1000]}",
        ]

        canonical_payload = "\n".join(canonical_components).encode("utf-8")
        return hashlib.sha256(canonical_payload).hexdigest()

    def extract_error_signature_from_logs(
        self,
        logs: str,
        repository: str = "SentinelOps",
        workflow_name: Optional[str] = None,
        job_name: Optional[str] = None,
        failed_step: Optional[str] = None,
        category: Optional[str] = None,
    ) -> str:
        """Extracts primary error signals from logs and generates signature."""
        clean_logs = self.normalize_text(logs or "")

        # Isolate top error lines
        error_lines = []
        for line in clean_logs.splitlines():
            line_clean = line.strip()
            if any(k in line_clean for k in ["error", "fail", "fatal", "exception", "traceback", "eresolve"]):
                error_lines.append(line_clean)
                if len(error_lines) >= 5:
                    break

        primary_error = " | ".join(error_lines) if error_lines else clean_logs[:300]
        return self.generate_signature(
            repository=repository,
            workflow_name=workflow_name,
            job_name=job_name,
            failed_step=failed_step,
            category=category,
            error_message=primary_error,
        )


# Singleton instance
error_signature_generator = ErrorSignatureGenerator()
