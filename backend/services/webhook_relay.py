"""
Smee.io Webhook Relay Service for SentinelOps.
Connects to a Smee.io Server-Sent Events (SSE) channel and forwards real GitHub
webhook events to the local SentinelOps Flask receiver (http://127.0.0.1:5000/api/webhooks/github).
Requires zero external CLI tools or accounts.
"""

import os
import json
import time
import threading
import urllib.request
import urllib.error
from typing import Optional, Dict, Any


class WebhookRelayService:
    """
    Background worker that connects to Smee.io SSE stream and forwards
    incoming GitHub webhook payloads to the local SentinelOps endpoint.
    """

    def __init__(
        self,
        channel_id: Optional[str] = None,
        target_url: str = "http://127.0.0.1:5000/api/webhooks/github",
    ):
        self.channel_id = channel_id or os.environ.get("SMEE_CHANNEL_ID") or "sentinelops-dev-channel"
        self.target_url = target_url
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.events_forwarded = 0
        self.last_event_time: Optional[str] = None
        self.last_error: Optional[str] = None
        self.connected = False

    @property
    def smee_url(self) -> str:
        return f"https://smee.io/{self.channel_id}"

    def get_status(self) -> Dict[str, Any]:
        """Returns the current state and telemetry of the webhook relay."""
        return {
            "running": self.running,
            "connected": self.connected,
            "channelId": self.channel_id,
            "smeeUrl": self.smee_url,
            "targetUrl": self.target_url,
            "eventsForwarded": self.events_forwarded,
            "lastEventTime": self.last_event_time,
            "lastError": self.last_error,
        }

    def start(self) -> bool:
        """Starts the relay in a background daemon thread."""
        if self.running:
            return True
        self.running = True
        self.thread = threading.Thread(target=self._stream_loop, daemon=True, name="SmeeRelayThread")
        self.thread.start()
        return True

    def stop(self):
        """Stops the relay background thread."""
        self.running = False
        self.connected = False

    def _stream_loop(self):
        """Continuously reads the Smee.io SSE stream and forwards messages."""
        try:
            from data_store import store
            store.add_log(
                service="Smee-Relay",
                level="INFO",
                message=f"Starting Smee.io Webhook Relay connecting to {self.smee_url}",
            )
        except Exception:
            pass

        while self.running:
            try:
                headers = {
                    "Accept": "text/event-stream",
                    "User-Agent": "SentinelOps-Smee-Relay/1.0",
                }
                req = urllib.request.Request(self.smee_url, headers=headers, method="GET")

                with urllib.request.urlopen(req, timeout=35) as response:
                    self.connected = True
                    self.last_error = None
                    buffer = ""

                    while self.running:
                        chunk = response.read(1024)
                        if not chunk:
                            break
                        buffer += chunk.decode("utf-8", errors="replace")

                        # SSE packets are separated by double newlines
                        while "\n\n" in buffer:
                            packet, buffer = buffer.split("\n\n", 1)
                            self._process_sse_packet(packet)

            except Exception as e:
                self.connected = False
                self.last_error = str(e)
                if self.running:
                    # Exponential backoff on disconnect
                    time.sleep(3.0)

    def _process_sse_packet(self, packet: str):
        """Parses an individual SSE packet and dispatches the webhook payload."""
        lines = packet.strip().splitlines()
        data_str = ""
        for line in lines:
            if line.startswith("data:"):
                data_str += line[5:].strip()

        if not data_str or data_str == "{}":
            return

        try:
            parsed = json.loads(data_str)
            # Smee payload format: {"headers": {...}, "body": {...}} or direct body
            if isinstance(parsed, dict) and "body" in parsed:
                headers = parsed.get("headers", {})
                body = parsed.get("body", {})
            else:
                headers = {"Content-Type": "application/json"}
                body = parsed

            self.forward_payload(body, headers)
        except Exception as ex:
            self.last_error = f"Parse error: {str(ex)}"

    def forward_payload(self, body: Any, headers: Dict[str, str]) -> bool:
        """Sends the webhook payload to the local Flask endpoint."""
        body_bytes = json.dumps(body).encode("utf-8") if not isinstance(body, (bytes, str)) else (
            body.encode("utf-8") if isinstance(body, str) else body
        )

        fwd_headers = {"Content-Type": "application/json"}
        # Forward key GitHub headers
        for k, v in headers.items():
            k_lower = k.lower()
            if k_lower.startswith("x-github-") or k_lower.startswith("x-hub-"):
                fwd_headers[k] = str(v)

        req = urllib.request.Request(
            self.target_url,
            data=body_bytes,
            headers=fwd_headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                self.events_forwarded += 1
                self.last_event_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                event_name = fwd_headers.get("X-GitHub-Event") or fwd_headers.get("x-github-event") or "webhook"

                try:
                    from data_store import store
                    store.add_log(
                        service="Smee-Relay",
                        level="INFO",
                        message=f"Forwarded '{event_name}' event from {self.smee_url} -> {self.target_url} (HTTP {resp.status})",
                    )
                except Exception:
                    pass

                return True
        except Exception as e:
            self.last_error = f"Forward error: {str(e)}"
            return False


# Singleton relay instance
webhook_relay_service = WebhookRelayService()
