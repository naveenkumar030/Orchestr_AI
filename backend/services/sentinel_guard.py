"""
SentinelGuard: Safety and Policy Layer for Autonomous AI Fixes.
Enforces branch protections, file path restrictions, and change size limits.
"""

import os
import re
from typing import Dict, Any, Tuple, List
import config

class SentinelGuard:
    def __init__(self):
        # Parse configs into lists for easier matching
        self.protected_branches = [b.strip() for b in config.PROTECTED_BRANCHES.split(",") if b.strip()]
        self.allowed_paths = [p.strip() for p in config.ALLOWED_PATHS.split(",") if p.strip()]
        self.blocked_paths = [p.strip() for p in config.BLOCKED_PATHS.split(",") if p.strip()]
        self.max_files_changed = config.MAX_FILES_CHANGED
        self.max_lines_changed = config.MAX_LINES_CHANGED
        self.require_human_approval = config.REQUIRE_HUMAN_APPROVAL

    def check_branch_protection(self, target_branch: str) -> Tuple[bool, str]:
        """Check if the target branch is protected and direct modification should be blocked."""
        # AI should never push directly to a protected branch
        for protected in self.protected_branches:
            # Check exact match or if branch is trying to target the protected one directly
            if target_branch == protected:
                return False, f"Operation blocked: direct modification of protected branch '{protected}' is not allowed."
        return True, ""

    def _match_path(self, path: str, pattern: str) -> bool:
        """Simple glob-like matching (* to regex)."""
        regex = "^" + pattern.replace(".", "\\.").replace("*", ".*") + "$"
        return bool(re.match(regex, path))

    def check_file_protection(self, file_path: str) -> Tuple[bool, str]:
        """Check if a file modification violates the file protection policy."""
        # Check against blocked paths first
        for blocked in self.blocked_paths:
            if self._match_path(file_path, blocked):
                return False, f"Operation blocked: AI attempted to modify a protected file matching '{blocked}'."
            # Handle directory blocks (e.g. terraform/*)
            if blocked.endswith("/*"):
                dir_pattern = blocked[:-2]
                if file_path.startswith(dir_pattern + "/") or file_path == dir_pattern:
                    return False, f"Operation blocked: AI attempted to modify a protected directory '{dir_pattern}'."
            # Sensitive file checks
            sensitive_patterns = [
                '.env', '.key', '.pem', '.cert', '.pfx', 'id_rsa',
                'terraform/', 'kubernetes/', '.github/workflows/', '.github/actions/',
                'secrets/', 'credentials/', 'credentials.json', 'service_account.json'
            ]
            for term in sensitive_patterns:
                if term in file_path.lower():
                    return False, f"Operation blocked: File path '{file_path}' appears to contain sensitive information or configuration."

        # Note: We are primarily blocking bad paths. We can optionally enforce allowed paths strictly,
        # but blocking is safer for a "default deny" on specific sensitive things.
        is_allowed = False
        allowed_list = [p.strip() for p in (os.getenv("ALLOWED_PATHS") or config.ALLOWED_PATHS).split(",") if p.strip()]
        for allowed in allowed_list:
            if self._match_path(file_path, allowed) or allowed == "*":
                is_allowed = True
                break
            if allowed.endswith("/*"):
                dir_pattern = allowed[:-2]
                if file_path.startswith(dir_pattern + "/") or file_path == dir_pattern:
                    is_allowed = True
                    break
            if allowed.startswith("*."):
                ext = allowed[1:]
                if file_path.endswith(ext):
                    is_allowed = True
                    break
                    
        if not is_allowed and allowed_list:
            return False, f"Operation blocked: File path '{file_path}' is not in the allowed paths list."

        return True, ""

    def detect_secrets_in_content(self, content: str) -> Tuple[bool, str]:
        """Basic secret detection using regex."""
        # Simple patterns that might indicate secrets
        patterns = [
            r"api_key\s*[:=]\s*['\"][a-zA-Z0-9_\-]+['\"]",
            r"password\s*[:=]\s*['\"][a-zA-Z0-9_\-]+['\"]",
            r"secret\s*[:=]\s*['\"][a-zA-Z0-9_\-]+['\"]",
            r"access_token\s*[:=]\s*['\"][a-zA-Z0-9_\-]+['\"]",
            r"ghp_[a-zA-Z0-9]{36}", # GitHub Personal Access Token
        ]
        
        for pattern in patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return False, "Operation blocked: Detected potential secret or credential in the proposed AI change."
        return True, ""

    def analyze_diff(self, diff: str) -> Dict[str, int]:
        """Calculates lines added and deleted from a unified diff."""
        lines_added = 0
        lines_deleted = 0
        
        for line in diff.splitlines():
            if line.startswith('+') and not line.startswith('+++'):
                lines_added += 1
            elif line.startswith('-') and not line.startswith('---'):
                lines_deleted += 1
                
        return {
            "lines_added": lines_added,
            "lines_deleted": lines_deleted,
            "total_lines_changed": lines_added + lines_deleted
        }

    def evaluate(self, target_branch: str, target_file: str, diff: str, fixed_content: str) -> Dict[str, Any]:
        """
        Aggregates all SentinelGuard checks.
        Returns a dictionary with status, risk_level, and any block reasons.
        """
        block_reasons = []
        
        # 1. Branch Protection
        branch_ok, branch_msg = self.check_branch_protection(target_branch)
        if not branch_ok:
            block_reasons.append(branch_msg)
            
        # 2. File Protection
        file_ok, file_msg = self.check_file_protection(target_file)
        if not file_ok:
            block_reasons.append(file_msg)
            
        # 3. Secret Detection
        secret_ok, secret_msg = self.detect_secrets_in_content(fixed_content)
        if not secret_ok:
            block_reasons.append(secret_msg)
            
        # 4. Change Size / Risk Protection
        diff_stats = self.analyze_diff(diff)
        total_changed = diff_stats["total_lines_changed"]
        
        if total_changed > self.max_lines_changed:
            block_reasons.append(f"Operation blocked: Proposed change exceeds maximum allowed lines changed ({total_changed} > {self.max_lines_changed}).")
            
        # Determine Risk Level and Status
        risk_level = "LOW"
        guard_status = "PASSED"
        
        if block_reasons:
            risk_level = "BLOCKED"
            guard_status = "BLOCKED"
        elif total_changed > self.max_lines_changed * 0.5:
             # Example warning heuristic: if it's more than 50% of the max limit, flag as high risk
             risk_level = "HIGH"
             guard_status = "WARNING"
        elif total_changed > self.max_lines_changed * 0.2:
             risk_level = "MEDIUM"
             
        return {
            "guard_status": guard_status,
            "risk_level": risk_level,
            "block_reasons": block_reasons,
            "diff_stats": diff_stats,
            "files_changed": 1  # Currently remediation service processes one file at a time
        }

# Singleton instance
sentinel_guard = SentinelGuard()
