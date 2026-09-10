"""
Entrypoint to run the SentinelOps Python Flask unified backend & frontend server.
Hosts both the compiled React UI and REST API on http://127.0.0.1:5000.
"""

import sys
import os
import subprocess
import webbrowser

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "cicd-app")
DIST_INDEX = os.path.join(FRONTEND_DIR, "dist", "index.html")

# Ensure backend directory is on sys.path
backend_dir = os.path.join(ROOT_DIR, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


def check_and_build_frontend(force=False):
    """Ensure the React frontend is compiled before launching Flask."""
    if not os.path.isfile(DIST_INDEX) or force:
        print("[SentinelOps] Building React UI production bundle...")
        res = subprocess.run("npm run build", shell=True, cwd=FRONTEND_DIR)
        if res.returncode != 0:
            print("[SentinelOps] Warning: npm run build failed. Frontend may not load properly.")
        else:
            print("[SentinelOps] React UI build complete.")


if __name__ == "__main__":
    force_build = "--build" in sys.argv
    open_browser = "--open" in sys.argv

    check_and_build_frontend(force=force_build)

    from app import app

    print("=" * 68)
    print("  [SentinelOps] Autonomous DevOps -- Unified Server")
    print("=" * 68)
    print("  Single server hosting both Frontend UI and REST API")
    print("  * Web UI:      http://127.0.0.1:5000")
    print("  * API Health:  http://127.0.0.1:5000/api/health")
    print("  * API Root:    http://127.0.0.1:5000/api/overview")
    print("=" * 68)

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 5000))

    if open_browser:
        webbrowser.open(f"http://127.0.0.1:{port}")

    app.run(host=host, port=port, debug=False)

