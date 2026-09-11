"""
SentinelOps Smee.io Webhook Relay CLI Launcher.
Runs a local relay forwarding webhooks from https://smee.io/{channel}
to http://127.0.0.1:5000/api/webhooks/github.

Usage:
  python run_relay.py
  python run_relay.py --channel my-custom-channel
  python run_relay.py --target http://127.0.0.1:5000/api/webhooks/github
"""

import sys
import os
import time
import argparse

# Add backend to path so we can import services directly
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(CURRENT_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.webhook_relay import WebhookRelayService


def main():
    parser = argparse.ArgumentParser(description="SentinelOps Smee.io Webhook Relay")
    parser.add_argument(
        "--channel",
        default=os.environ.get("SMEE_CHANNEL_ID", "sentinelops-dev-channel"),
        help="Smee.io channel ID (e.g. 'my-channel' for https://smee.io/my-channel)",
    )
    parser.add_argument(
        "--target",
        default="http://127.0.0.1:5000/api/webhooks/github",
        help="Local SentinelOps endpoint to forward webhook events to",
    )
    args = parser.parse_args()

    relay = WebhookRelayService(channel_id=args.channel, target_url=args.target)

    print("=" * 70)
    print("  SentinelOps Smee.io Webhook Relay -- Live GitHub Forwarder")
    print(f"  Smee Channel:  {relay.smee_url}")
    print(f"  Forwarding To: {relay.target_url}")
    print("=" * 70)
    print("  Configure your GitHub Repository Webhook:")
    print(f"    1. Payload URL:  {relay.smee_url}")
    print("    2. Content Type: application/json")
    print("    3. Events:       Workflow runs, Pushes, Pull requests")
    print("=" * 70)
    print("  Connecting to Smee.io stream...")

    relay.start()
    time.sleep(1.0)

    try:
        last_count = 0
        while True:
            time.sleep(2.0)
            status = relay.get_status()
            if status["eventsForwarded"] != last_count:
                print(f"  [RELAY] Forwarded event #{status['eventsForwarded']} at {status['lastEventTime']}")
                last_count = status["eventsForwarded"]
            if status["lastError"]:
                print(f"  [ERROR] {status['lastError']}")
    except KeyboardInterrupt:
        print("\n  Stopping relay...")
        relay.stop()
        print("  Relay stopped cleanly.")


if __name__ == "__main__":
    main()
