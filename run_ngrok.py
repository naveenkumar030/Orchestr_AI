"""
SentinelOps Ngrok Tunnel CLI Launcher.
Exposes the local SentinelOps Flask server (port 5000) to the public internet
via a secure HTTPS ngrok tunnel for real GitHub Webhooks and GitHub Actions events.

Usage:
  python run_ngrok.py
  python run_ngrok.py --port 5000
"""

import sys
import os
import time
import argparse

# Ensure backend directory is in python search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(CURRENT_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.ngrok_service import ngrok_service


def main():
    parser = argparse.ArgumentParser(description="SentinelOps Ngrok Live Tunnel")
    parser.add_argument(
        "--port",
        type=int,
        default=5000,
        help="Local port to forward (default: 5000)",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="Ngrok authtoken (defaults to configured token)",
    )
    args = parser.parse_args()

    print("=" * 72)
    print("  SentinelOps Ngrok Live Webhook Tunnel")
    print(f"  Forwarding local port: http://127.0.0.1:{args.port}")
    print("=" * 72)
    print("  Connecting to ngrok...")

    res = ngrok_service.start(port=args.port, authtoken=args.token)

    if not res.get("running") or not res.get("publicUrl"):
        print(f"  [ERROR] Failed to start ngrok tunnel: {res.get('error') or res.get('lastError')}")
        sys.exit(1)

    public_url = res["publicUrl"]
    webhook_url = res["webhookUrl"]

    print("=" * 72)
    print(f"  * Public Tunnel:   {public_url}")
    print(f"  * Webhook URL:     {webhook_url}")
    print("=" * 72)
    print("  Configure your GitHub Repository Webhook:")
    print(f"    1. Payload URL:  {webhook_url}")
    print("    2. Content type: application/json")
    print("    3. Secret:       (Optional, matched to GITHUB_WEBHOOK_SECRET)")
    print("    4. Events:       Workflow runs, Pushes, Pull requests")
    print("=" * 72)
    print("  Press Ctrl+C to stop tunnel...\n")

    try:
        while True:
            time.sleep(2.0)
    except KeyboardInterrupt:
        print("\n  Disconnecting ngrok tunnel...")
        ngrok_service.stop()
        print("  Tunnel stopped cleanly.")


if __name__ == "__main__":
    main()
