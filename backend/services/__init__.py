"""
Services package for SentinelOps.
Exports singleton service instances for use by routes and agents.
"""

from services.github_service import github_service
from services.incident_service import incident_service
from services.remediation_service import remediation_service
from services.webhook_relay import webhook_relay_service
from services.ngrok_service import ngrok_service

__all__ = [
    "github_service",
    "incident_service",
    "remediation_service",
    "webhook_relay_service",
    "ngrok_service",
]



