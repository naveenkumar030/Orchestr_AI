"""
Autonomous Fleet Monitor for SentinelOps.
Constantly polls the connected GitHub repository (e.g. naveenkumar030/testingrepo)
for workflow runs, discovers CI/CD failures, and dispatches the AI fleet (Healer-Alpha)
to diagnose, synthesize fixes, and open pull requests autonomously.
"""

import logging
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)


class FleetMonitorService:
    def __init__(self, interval_seconds: int = 30):
        self.interval = interval_seconds
        self.is_running = False
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    def start(self):
        with self._lock:
            if self.is_running:
                return
            self.is_running = True
            self._thread = threading.Thread(target=self._monitor_loop, daemon=True, name="FleetMonitorThread")
            self._thread.start()
            logger.info("SentinelOps Autonomous Fleet Monitor started (polling every %ds)", self.interval)

    def stop(self):
        with self._lock:
            self.is_running = False

    def trigger_scan_now(self) -> dict[str, Any]:
        """Manually trigger an immediate scan across GitHub Actions for failures."""
        try:
            from data_store import store
            store._last_gh_fetch = 0.0
            store._sync_github_runs(force=True)
            return {
                "status": "success",
                "message": "Autonomous fleet scan completed across GitHub Actions.",
                "active_agents": [a["name"] for a in store.ai_agents if a.get("status") in ["active", "processing"]],
            }
        except Exception as e:
            logger.error("Scan error: %s", e, exc_info=True)
            return {"status": "error", "message": str(e)}

    def _monitor_loop(self):
        time.sleep(5)  # initial startup delay
        while self.is_running:
            try:
                from data_store import store
                store._sync_github_runs(force=True)
            except Exception as e:
                logger.error("Fleet monitor loop error: %s", e)
            time.sleep(self.interval)


fleet_monitor = FleetMonitorService(interval_seconds=30)
