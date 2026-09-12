import pytest
import os
import sys

# Ensure backend directory is in python search path
CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# We need to make sure we don't accidentally load different configs than the ones we expect.
# We'll patch config variables in the tests.

import config
config.PROTECTED_BRANCHES = "main,master,production,prod"
config.ALLOWED_PATHS = "src/*,app/*,tests/*,*.py,*.js,*.ts,*.json,*.txt,*.md,*.html,*.css"
config.BLOCKED_PATHS = ".env*,.github/workflows/*,.github/actions/*,terraform/*,kubernetes/*,secrets/*,credentials/*,*.pem,*.key"
config.MAX_FILES_CHANGED = 10
config.MAX_LINES_CHANGED = 500

from services.sentinel_guard import SentinelGuard

@pytest.fixture
def guard():
    return SentinelGuard()

def test_branch_protection(guard):
    ok, _ = guard.check_branch_protection("feature-branch")
    assert ok is True

    ok, msg = guard.check_branch_protection("main")
    assert ok is False
    assert "direct modification of protected branch" in msg

    ok, msg = guard.check_branch_protection("master")
    assert ok is False

def test_file_protection_blocked(guard):
    ok, msg = guard.check_file_protection(".env")
    assert ok is False
    assert "Operation blocked" in msg

    ok, msg = guard.check_file_protection(".github/workflows/deploy.yml")
    assert ok is False

    ok, msg = guard.check_file_protection("kubernetes/deployment.yaml")
    assert ok is False

def test_file_protection_allowed(guard):
    ok, msg = guard.check_file_protection("src/main.py")
    assert ok is True

    ok, msg = guard.check_file_protection("package.json")
    assert ok is True

def test_secret_detection(guard):
    safe_content = "def hello():\n    print('world')"
    ok, msg = guard.detect_secrets_in_content(safe_content)
    assert ok is True

    unsafe_content = "api_key = 'abcdef123456'"
    ok, msg = guard.detect_secrets_in_content(unsafe_content)
    assert ok is False
    assert "Detected potential secret" in msg

    unsafe_gh_token = "Authorization: Bearer ghp_aBcDeF1234567890aBcDeF1234567890aBcDeF"
    ok, msg = guard.detect_secrets_in_content(unsafe_gh_token)
    assert ok is False

def test_change_size_limit(guard):
    # Construct a huge diff
    diff = "--- a/file\n+++ b/file\n"
    for i in range(600):
        diff += f"+ line {i}\n"
        
    stats = guard.analyze_diff(diff)
    assert stats["lines_added"] == 600
    assert stats["total_lines_changed"] == 600

    result = guard.evaluate("feature", "src/file.py", diff, "content")
    assert result["guard_status"] == "BLOCKED"
    assert "exceeds maximum allowed lines" in result["block_reasons"][0]

def test_evaluate_safe_change(guard):
    diff = '''--- a/src/app.py
+++ b/src/app.py
@@ -10,3 +10,3 @@
-    print("bug")
+    print("fix")'''
    
    result = guard.evaluate("sentinelops/fix-123", "src/app.py", diff, "print('fix')")
    assert result["guard_status"] == "PASSED"
    assert result["risk_level"] == "LOW"
    assert len(result["block_reasons"]) == 0
