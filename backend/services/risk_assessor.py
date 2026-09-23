"""
Risk Assessor for SentinelOps Autonomous Fixes.
Deterministically evaluates risk levels (low, medium, high, critical)
based on patch size, affected file categories, destructive commands, and security factors.
"""

import re
from typing import Any


class RiskAssessor:
    """
    Evaluates proposed patches and changes across 12 deterministic criteria.
    Classifies risk into: 'low', 'medium', 'high', 'critical'.
    """

    # Critical destructive shell / SQL commands
    DESTRUCTIVE_PATTERNS = [
        (r"\brm\s+-[rRfF]{1,3}\b", "Destructive recursive file deletion (rm -rf)"),
        (r"\bdel\s+/[fFqsQS]{1,3}\b", "Windows destructive file deletion"),
        (r"\bDROP\s+TABLE\b", "Destructive SQL table drop"),
        (r"\bDROP\s+DATABASE\b", "Destructive SQL database drop"),
        (r"\bTRUNCATE\s+TABLE\b", "Destructive SQL table truncation"),
        (r"\bDELETE\s+FROM\s+\w+\s*(?:;|\n|$)(?!.*WHERE)", "Unconstrained SQL delete without WHERE clause"),
        (r"\bformat\s+[cC-zZ]:", "Disk formatting command"),
        (r"\bchmod\s+777\b", "Unsafe universal permissions (chmod 777)"),
        (r"\beval\s*\(", "Unsafe dynamic code execution (eval)"),
        (r"\bos\.system\s*\(", "Unsafe raw shell execution (os.system)"),
        (r"\bexec\s*\(", "Unsafe dynamic code execution (exec)"),
        (r"\bshutil\.rmtree\s*\(", "Destructive filesystem directory tree removal"),
        (r"\b(?:AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|PRIVATE_KEY|DATABASE_PASSWORD)\s*=\s*['\"][^'\"]{6,}['\"]", "Credential / secret exposure in patch"),
    ]

    # High-risk sensitive file patterns
    HIGH_RISK_FILE_PATTERNS = [
        r"(?:auth|authentication|oauth|jwt|session|token_validator|permission|rbac)",
        r"(?:migration|alembic|migrations|schema\.sql|\.sql$)",
        r"(?:\.github/workflows/|\.gitlab-ci\.yml|\.circleci/|Jenkinsfile)",
        r"(?:k8s|kubernetes|helm|terraform|\.tf$|Dockerfile|docker-compose)",
        r"(?:production|prod\.env|prod\.config)",
        r"(?:vault|secret|credential)",
    ]

    # Medium-risk dependency / config files
    MEDIUM_RISK_FILE_PATTERNS = [
        r"(?:package\.json|package-lock\.json|requirements\.txt|Pipfile|pom\.xml|build\.gradle|go\.mod|Cargo\.toml)",
        r"(?:tsconfig\.json|vite\.config|\.eslintrc|webpack\.config)",
    ]

    def __init__(self):
        pass

    def analyze_diff(self, patch: str) -> dict[str, int]:
        """Calculates added, deleted, and total modified lines from a unified diff."""
        if not patch:
            return {"lines_added": 0, "lines_deleted": 0, "total_lines": 0}

        lines_added = 0
        lines_deleted = 0
        for line in patch.splitlines():
            if line.startswith("+") and not line.startswith("+++"):
                lines_added += 1
            elif line.startswith("-") and not line.startswith("---"):
                lines_deleted += 1

        return {
            "lines_added": lines_added,
            "lines_deleted": lines_deleted,
            "total_lines": lines_added + lines_deleted,
        }

    def detect_destructive_patterns(self, patch: str) -> list[str]:
        """Detects destructive commands, raw shell execution, or credential leaks in patch."""
        findings = []
        if not patch:
            return findings

        # Check only added lines to prevent flagging existing code being removed
        added_lines = "\n".join(
            line[1:] for line in patch.splitlines() if line.startswith("+") and not line.startswith("+++")
        )
        content_to_check = added_lines if added_lines else patch

        for pattern, description in self.DESTRUCTIVE_PATTERNS:
            if re.search(pattern, content_to_check, re.IGNORECASE):
                findings.append(description)

        return findings

    def assess_file_risk(self, filename: str) -> str:
        """Classifies individual file risk level: 'low', 'medium', 'high'."""
        fname_lower = filename.lower()

        # Check high risk files
        for pattern in self.HIGH_RISK_FILE_PATTERNS:
            if re.search(pattern, fname_lower):
                return "high"

        # Check medium risk files
        for pattern in self.MEDIUM_RISK_FILE_PATTERNS:
            if re.search(pattern, fname_lower):
                return "medium"

        return "low"

    def assess(
        self,
        patch: str,
        affected_files: list[str],
        target_branch: str = "main",
        fix_type: str = "code",
        diagnoser_category: str = "unknown",
        repository_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Executes full deterministic risk assessment on proposed fix.
        Returns structured RiskAssessmentResult.
        """
        affected_files = affected_files or []
        diff_stats = self.analyze_diff(patch)
        destructive_findings = self.detect_destructive_patterns(patch)

        factors = []
        file_risks = {}
        has_high_risk_file = False
        has_medium_risk_file = False

        for f in affected_files:
            r = self.assess_file_risk(f)
            file_risks[f] = r
            if r == "high":
                has_high_risk_file = True
                factors.append(f"Modifies high-risk sensitive component or workflow: '{f}'")
            elif r == "medium":
                has_medium_risk_file = True
                factors.append(f"Modifies dependency or configuration manifest: '{f}'")

        # Line and file count impact
        total_lines = diff_stats["total_lines"]
        files_count = len(affected_files)

        if files_count > 3:
            factors.append(f"Wide blast radius: modifies {files_count} files")
        if total_lines > 150:
            factors.append(f"Large patch volume: {total_lines} total lines changed")
        elif total_lines > 50:
            factors.append(f"Moderate patch volume: {total_lines} lines changed")

        # Branch target
        if target_branch in ["main", "master", "release", "production"]:
            factors.append(f"Targets protected release branch '{target_branch}'")

        # Determine overall Risk Level
        risk_level = "low"
        security_concerns = list(destructive_findings)

        if destructive_findings:
            risk_level = "critical"
            factors.extend(destructive_findings)
        elif has_high_risk_file or total_lines > 150 or files_count > 3:
            risk_level = "high"
        elif total_lines > 50 or files_count > 1 or (has_medium_risk_file and total_lines > 15):
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "risk_level": risk_level,
            "factors": factors,
            "file_risks": file_risks,
            "diff_stats": diff_stats,
            "security_concerns": security_concerns,
            "destructive_patterns_detected": len(destructive_findings) > 0,
            "requires_human_review": risk_level in ["medium", "high", "critical"],
        }


# Singleton instance
risk_assessor = RiskAssessor()
