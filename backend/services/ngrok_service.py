"""
Ngrok Tunnel Service for SentinelOps.
Opens a public HTTPS tunnel to the local Flask backend (port 5000)
enabling real GitHub Webhooks and GitHub Actions delivery.
"""

import os
from typing import Any

DEFAULT_AUTHTOKEN = os.environ.get("NGROK_AUTHTOKEN", "")


class NgrokService:
    """
    Manages the lifecycle of an ngrok HTTP tunnel forwarding requests
    directly to the SentinelOps Flask server.
    """

    def __init__(self, authtoken: str | None = None):
        self.authtoken = authtoken or DEFAULT_AUTHTOKEN
        self.public_url: str | None = None
        self.webhook_url: str | None = None
        self.tunnel = None
        self.port = 5000
        self.running = False
        self.last_error: str | None = None

    def start(self, port: int = 5000, authtoken: str | None = None) -> dict[str, Any]:
        """Starts an ngrok tunnel on the specified port."""
        if self.running and self.public_url:
            return self.get_status()

        self.port = port
        token_to_use = authtoken or self.authtoken

        try:
            from pyngrok import ngrok

            if token_to_use:
                ngrok.set_auth_token(token_to_use)
                self.authtoken = token_to_use

            # Open HTTP tunnel
            self.tunnel = ngrok.connect(self.port, proto="http", bind_tls=True)
            raw_url = self.tunnel.public_url
            # Enforce HTTPS
            if raw_url.startswith("http://"):
                raw_url = "https://" + raw_url[7:]

            self.public_url = raw_url
            self.webhook_url = f"{self.public_url}/api/webhooks/github"
            self.running = True
            self.last_error = None

            try:
                from data_store import store
                store.add_log(
                    service="ngrok",
                    level="INFO",
                    message=f"Live ngrok tunnel established: {self.public_url} -> http://127.0.0.1:{self.port}",
                )
                store.add_log(
                    service="ngrok",
                    level="INFO",
                    message=f"Live Webhook URL ready: {self.webhook_url}",
                )
            except Exception:
                pass

            return self.get_status()

        except Exception as ex:
            self.running = False
            self.last_error = str(ex)
            return {
                "running": False,
                "publicUrl": None,
                "webhookUrl": None,
                "error": str(ex),
            }

    def stop(self) -> dict[str, Any]:
        """Disconnects the ngrok tunnel and kills the process."""
        try:
            from pyngrok import ngrok

            if self.tunnel and self.public_url:
                ngrok.disconnect(self.public_url)
            ngrok.kill()
        except Exception as ex:
            self.last_error = str(ex)

        self.running = False
        self.tunnel = None
        self.public_url = None
        self.webhook_url = None

        try:
            from data_store import store
            store.add_log(
                service="ngrok",
                level="INFO",
                message="ngrok tunnel disconnected cleanly.",
            )
        except Exception:
            pass

        return self.get_status()

    def get_status(self) -> dict[str, Any]:
        """Returns the current state and URLs for the ngrok tunnel."""
        return {
            "running": self.running,
            "publicUrl": self.public_url,
            "webhookUrl": self.webhook_url,
            "port": self.port,
            "tokenConfigured": bool(self.authtoken),
            "lastError": self.last_error,
        }


# Singleton ngrok service instance
ngrok_service = NgrokService()
