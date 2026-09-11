"""
Services package for SentinelOps.
Exports singleton service instances for use by routes and agents.
"""

from services.github_service import github_service
from services.incident_service import incident_service

__all__ = ["github_service", "incident_service"]
