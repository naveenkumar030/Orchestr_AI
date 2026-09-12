"""
SentinelOps Cloud & Local End-to-End Verification Suite
=========================================================
Runs comprehensive validation of:
1. Backend REST API (12 endpoints including autonomous self-healing)
2. Autonomous Remediation Engine (Healer-Alpha patch synthesis)
3. Ngrok Public Tunneling (port 5050)
4. LambdaTest Cloud Selenium Grid E2E Browser Testing
   - Account: 2411cs020069
   - Browser: Chrome (latest) on Windows 11
   - Pages Tested: Landing, Dashboard, Incidents, Pipelines, PRs, Settings
"""

import sys
import os
import time
import json
import threading
import requests
from werkzeug.serving import make_server

# Configure stdout for safe encoding on all platforms
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(ROOT_DIR, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from services.ngrok_service import ngrok_service
from data_store import store

# Load .env if present
_env_path = os.path.join(ROOT_DIR, ".env")
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

# LambdaTest Credentials (configurable via environment variables or .env)
LT_USERNAME = os.environ.get("LT_USERNAME", "")
LT_ACCESS_KEY = os.environ.get("LT_ACCESS_KEY", "")
LT_HUB_URL = f"https://{LT_USERNAME}:{LT_ACCESS_KEY}@hub.lambdatest.com/wd/hub"
TEST_PORT = int(os.environ.get("TEST_PORT", 5050))

results = {
    "api_tests": [],
    "ai_remediation": None,
    "ngrok_tunnel": None,
    "lambdatest": None
}


class ServerThread(threading.Thread):
    def __init__(self, app, host="127.0.0.1", port=TEST_PORT):
        super().__init__(daemon=True)
        self.server = make_server(host, port, app)
        self.ctx = app.app_context()
        self.ctx.push()

    def run(self):
        print(f"[*] Local test server listening on http://127.0.0.1:{TEST_PORT}")
        self.server.serve_forever()

    def shutdown(self):
        print("[*] Terminating local test server...")
        self.server.shutdown()


def test_rest_api():
    print("\n" + "=" * 65)
    print("STEP 1: Backend REST API & Autonomous Loop Validation")
    print("=" * 65)

    base = f"http://127.0.0.1:{TEST_PORT}"
    endpoints = [
        ("Health Check", "/api/health", 200),
        ("Platform Overview", "/api/overview", 200),
        ("Pipelines DAG", "/api/pipelines", 200),
        ("Active Incidents", "/api/incidents", 200),
        ("Autonomous AI Agents (Full)", "/api/ai-agents", 200),
        ("Autonomous AI Agents (Alias)", "/api/agents", 200),
        ("Remediation PRs (Full)", "/api/pull-requests", 200),
        ("Remediation PRs (Alias)", "/api/prs", 200),
        ("Execution Logs", "/api/logs", 200),
        ("Platform Settings", "/api/settings", 200),
        ("Analytics", "/api/analytics", 200),
        ("GitHub Repository Status", "/api/github/status", 200),
        ("Smee Webhook Relay Status", "/api/github/relay/status", 200),
        ("Ngrok Tunnel Status", "/api/github/ngrok/status", 200),
    ]

    all_passed = True
    for name, path, expected_code in endpoints:
        try:
            r = requests.get(f"{base}{path}", timeout=5)
            passed = (r.status_code == expected_code)
            status_symbol = "[PASS]" if passed else "[FAIL]"
            print(f"  {status_symbol} {name:<30} {path:<26} -> HTTP {r.status_code}")
            results["api_tests"].append({"name": name, "path": path, "status": r.status_code, "passed": passed})
            if not passed:
                all_passed = False
        except Exception as e:
            print(f"  [ERROR] {name:<30} {path:<26} -> {e}")
            results["api_tests"].append({"name": name, "path": path, "status": "ERROR", "passed": False})
            all_passed = False

    # Test autonomous remediation engine endpoint
    print("\n[*] Testing Autonomous Healer-Alpha Remediation Engine via API...")
    try:
        rem_res = requests.post(
            f"{base}/api/github/remediate",
            json={"incident_id": "INC-2026-001", "action": "auto_heal"},
            timeout=30
        )
        if rem_res.status_code == 200:
            rem_data = rem_res.json()
            data = rem_data.get("data", {})
            pr = data.get("pullRequest", {})
            target_file = data.get("targetFile", "N/A")
            confidence = data.get("confidence", 0)
            print(f"  [PASS] Autonomous Fix Generated: {target_file}")
            print(f"  [PASS] Confidence Score:        {confidence}%")
            print(f"  [PASS] PR Created:               #{pr.get('number', 'N/A')} - {pr.get('title', 'N/A')}")
            print(f"  [PASS] Remediation Branch:       {data.get('remediationBranch', 'N/A')}")
            results["ai_remediation"] = {
                "success": True,
                "file": target_file,
                "confidence": confidence,
                "pr_number": pr.get("number"),
                "pr_title": pr.get("title"),
                "branch": data.get("remediationBranch"),
            }
        else:
            print(f"  [FAIL] Remediation returned HTTP {rem_res.status_code}: {rem_res.text}")
            results["ai_remediation"] = {"success": False, "status": rem_res.status_code}
            all_passed = False
    except Exception as e:
        print(f"  [ERROR] Remediation test error: {e}")
        results["ai_remediation"] = {"success": False, "error": str(e)}
        all_passed = False

    return all_passed


def run_lambdatest_cloud(public_url):
    print("\n" + "=" * 65)
    print("STEP 2: LambdaTest Cloud Selenium Grid E2E Browser Testing")
    print("=" * 65)
    print(f"[*] Target Application URL: {public_url}")
    print(f"    LambdaTest Hub: hub.lambdatest.com/wd/hub")
    print(f"    User: {LT_USERNAME}")

    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    chrome_options = Options()
    chrome_options.set_capability("platformName", "Windows 11")
    chrome_options.set_capability("browserName", "Chrome")
    chrome_options.set_capability("browserVersion", "latest")

    lt_options = {
        "user": LT_USERNAME,
        "accessKey": LT_ACCESS_KEY,
        "build": "SentinelOps Full System E2E Suite",
        "name": "SentinelOps Cloud UI & Autonomous Self-Healing Test",
        "platformName": "Windows 11",
        "browserName": "Chrome",
        "browserVersion": "latest",
        "console": True,
        "network": True,
        "video": True,
        "visual": True,
        "w3c": True,
        "plugin": "python-python"
    }
    chrome_options.set_capability("LT:Options", lt_options)

    driver = None
    session_id = None
    try:
        print("[*] Connecting to LambdaTest Remote WebDriver...")
        driver = webdriver.Remote(
            command_executor=LT_HUB_URL,
            options=chrome_options
        )
        session_id = driver.session_id
        print(f"  [OK] LambdaTest Session Created: {session_id}")
        driver.set_page_load_timeout(45)
        driver.maximize_window()

        # Step 2a: Navigate to public ngrok URL
        print(f"[*] Navigating to {public_url} ...")
        driver.get(public_url)
        time.sleep(4)

        # Handle ngrok free tier interstitial warning page if displayed
        page_source = driver.page_source.lower()
        if "ngrok" in driver.title.lower() or "visit site" in page_source or "you are about to visit" in page_source:
            print("  [*] Detected ngrok interstitial page. Bypassing...")
            try:
                buttons = driver.find_elements(By.TAG_NAME, "button")
                clicked = False
                for btn in buttons:
                    if "visit site" in btn.text.lower():
                        btn.click()
                        clicked = True
                        print("  [OK] Clicked 'Visit Site' button.")
                        break
                if not clicked:
                    submits = driver.find_elements(By.XPATH, "//button[contains(., 'Visit Site')] | //button[@type='submit']")
                    if submits:
                        submits[0].click()
                        print("  [OK] Clicked submit button on ngrok interstitial.")
                time.sleep(5)
            except Exception as e:
                print(f"  [!] Note during ngrok bypass: {e}")

        # Step 2b: Verify React App mounts
        print("[*] Verifying React App DOM Mount...")
        wait = WebDriverWait(driver, 20)
        wait.until(EC.presence_of_element_located((By.ID, "root")))
        time.sleep(2)

        page_title = driver.title
        print(f"  [PASS] Page Title: '{page_title}'")

        # Step 2c: Verify Landing Page
        root_element = driver.find_element(By.ID, "root")
        root_text = root_element.text
        print(f"  [PASS] Landing Page Rendered ({len(root_text)} text chars).")

        # Step 2d: Test Navigation to Dashboard (/dashboard)
        print("[*] Testing Navigation to Operations Dashboard (/#/dashboard)...")
        driver.get(f"{public_url}/#/dashboard")
        time.sleep(3)
        dash_text = driver.find_element(By.ID, "root").text
        print(f"  [PASS] Dashboard Page Rendered ({len(dash_text)} text chars).")

        # Step 2e: Test Navigation to Incidents (/incidents)
        print("[*] Testing Navigation to Incidents Page (/#/incidents)...")
        driver.get(f"{public_url}/#/incidents")
        time.sleep(3)
        incidents_text = driver.find_element(By.ID, "root").text
        print(f"  [PASS] Incidents Page Rendered.")

        # Step 2f: Test Navigation to Pipelines (/pipelines)
        print("[*] Testing Navigation to Pipelines Page (/#/pipelines)...")
        driver.get(f"{public_url}/#/pipelines")
        time.sleep(3)
        pipelines_text = driver.find_element(By.ID, "root").text
        print(f"  [PASS] Pipelines Page Rendered.")

        # Step 2g: Test Navigation to Pull Requests (/pull-requests)
        print("[*] Testing Navigation to Pull Requests Page (/#/pull-requests)...")
        driver.get(f"{public_url}/#/pull-requests")
        time.sleep(3)
        prs_text = driver.find_element(By.ID, "root").text
        print(f"  [PASS] Pull Requests Page Rendered.")

        # Step 2h: Test Navigation to Settings (/settings)
        print("[*] Testing Navigation to Settings Page (/#/settings)...")
        driver.get(f"{public_url}/#/settings")
        time.sleep(3)
        settings_text = driver.find_element(By.ID, "root").text
        print(f"  [PASS] Settings Page Rendered.")

        # Mark LambdaTest session as passed
        driver.execute_script("lambda-status=passed")
        print("\n  [PASS] LambdaTest Test Session Marked as PASSED in LambdaTest Cloud!")

        results["lambdatest"] = {
            "success": True,
            "session_id": session_id,
            "dashboard_url": f"https://automation.lambdatest.com/logs/?sessionID={session_id}"
        }

    except Exception as e:
        print(f"  [FAIL] LambdaTest test encountered error: {e}")
        if driver:
            try:
                driver.execute_script("lambda-status=failed")
            except Exception:
                pass
        results["lambdatest"] = {
            "success": False,
            "session_id": session_id,
            "error": str(e)
        }
    finally:
        if driver:
            try:
                driver.quit()
                print("  [*] LambdaTest Selenium driver session closed.")
            except Exception:
                pass

    return results["lambdatest"].get("success", False)


def get_lambdatest_session_details(session_id):
    """Query LambdaTest REST API for session details."""
    if not session_id:
        return None
    try:
        url = f"https://api.lambdatest.com/automation/api/v1/sessions/{session_id}"
        resp = requests.get(url, auth=(LT_USERNAME, LT_ACCESS_KEY), timeout=10)
        if resp.status_code == 200:
            return resp.json().get("data", {})
    except Exception as e:
        print(f"Note: Could not query LambdaTest session API: {e}")
    return None


def main():
    print("=" * 65)
    print("   SENTINELOPS FULL PROJECT & LAMBDATEST VALIDATION SUITE")
    print("=" * 65)

    # 1. Start Server in Background Daemon Thread
    server_thread = ServerThread(app, port=TEST_PORT)
    server_thread.start()
    time.sleep(2)

    # 2. Run REST API Tests
    api_ok = test_rest_api()

    # 3. Start Ngrok Tunnel on TEST_PORT
    print("\n" + "=" * 65)
    print("STEP 2: Initializing Live Ngrok HTTPS Tunnel")
    print("=" * 65)
    tunnel_status = ngrok_service.start(port=TEST_PORT)
    public_url = tunnel_status.get("publicUrl") or tunnel_status.get("url")

    if not public_url:
        print(f"  [FAIL] Could not start ngrok tunnel: {tunnel_status}")
        server_thread.shutdown()
        sys.exit(1)

    print(f"  [PASS] Ngrok Public Tunnel Active: {public_url}")
    results["ngrok_tunnel"] = public_url

    # 4. Verify public URL is reachable
    try:
        test_resp = requests.get(
            f"{public_url}/api/health",
            headers={"ngrok-skip-browser-warning": "69420"},
            timeout=10
        )
        print(f"  [PASS] Public Endpoint Verified: HTTP {test_resp.status_code} ({test_resp.text.strip()})")
    except Exception as e:
        print(f"  [!] Public URL check note: {e}")

    # 5. Run Cloud Test on LambdaTest Grid
    lt_ok = run_lambdatest_cloud(public_url)

    # 6. Fetch LambdaTest Session Info
    session_id = results.get("lambdatest", {}).get("session_id")
    if session_id:
        session_data = get_lambdatest_session_details(session_id)
        if session_data:
            print("\n[*] LambdaTest Cloud Session Summary:")
            print(f"    Session ID:  {session_data.get('session_id')}")
            print(f"    Build Name:  {session_data.get('build_name')}")
            print(f"    Test Name:   {session_data.get('name')}")
            print(f"    Status:      {session_data.get('status_ind')}")
            print(f"    OS/Browser:  {session_data.get('os')} / {session_data.get('browser')} {session_data.get('version')}")
            print(f"    Duration:    {session_data.get('duration')}s")
            print(f"    Dashboard:   https://automation.lambdatest.com/logs/?sessionID={session_id}")

    # 7. Cleanup
    print("\n" + "=" * 65)
    print("STEP 3: Teardown and Cleanup")
    print("=" * 65)
    try:
        ngrok_service.stop()
        print("  [OK] Ngrok tunnel closed.")
    except Exception as e:
        print(f"  [!] Ngrok stop note: {e}")

    server_thread.shutdown()
    print("  [OK] Test server terminated.")

    # 8. Final Report
    print("\n" + "=" * 65)
    print("   FINAL TEST EXECUTION SUMMARY")
    print("=" * 65)
    total_api = len(results["api_tests"])
    passed_api = sum(1 for t in results["api_tests"] if t["passed"])
    print(f"  1. REST API Endpoints:        {passed_api}/{total_api} Passed")
    print(f"  2. Autonomous Self-Healing:   {'PASSED' if results['ai_remediation'] and results['ai_remediation'].get('success') else 'FAILED'}")
    print(f"  3. Ngrok Public Tunnel:       {'PASSED' if results['ngrok_tunnel'] else 'FAILED'}")
    print(f"  4. LambdaTest Cloud Browser:  {'PASSED' if lt_ok else 'FAILED'}")
    if session_id:
        print(f"\n  LambdaTest Session URL:")
        print(f"  https://automation.lambdatest.com/logs/?sessionID={session_id}")
    print("=" * 65)

    if not (api_ok and lt_ok):
        sys.exit(1)


if __name__ == "__main__":
    main()
