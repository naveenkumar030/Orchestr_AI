"""
Services package for SentinelOps.
Exports singleton service instances for use by routes and agents.
"""

from services.agents import (
    critic_agent,
    diagnoser_agent,
    fix_suggester_agent,
    multi_agent_orchestrator,
)
from services.confidence_gate import (
    CONFIDENCE_GATE_CONFIG,
    ConfidenceGate,
    confidence_gate,
)
from services.deployment_guard import deployment_guard
from services.deployment_service import deployment_service
from services.github_action_service import GitHubActionService, github_action_service
from services.github_service import github_service
from services.health_check_service import health_check_service
from services.human_approval_service import HumanApprovalService, human_approval_service
from services.incident_service import incident_service
from services.merge_guard import merge_guard
from services.ngrok_service import ngrok_service
from services.remediation_orchestrator import remediation_orchestrator
from services.remediation_service import remediation_service
from services.risk_assessor import RiskAssessor, risk_assessor
from services.rollback_service import rollback_service
from services.secret_sanitizer import secret_sanitizer
from services.sentinel_guard import sentinel_guard
from services.slack_notification_service import (
    SlackNotificationService,
    slack_notification_service,
)
from services.validation_service import validation_service
from services.validator_agent import validator_agent
from services.webhook_relay import webhook_relay_service

__all__ = [
    "CONFIDENCE_GATE_CONFIG",
    "ConfidenceGate",
    "GitHubActionService",
    "HumanApprovalService",
    "RiskAssessor",
    "SlackNotificationService",
    "confidence_gate",
    "critic_agent",
    "deployment_guard",
    "deployment_service",
    "diagnoser_agent",
    "fix_suggester_agent",
    "github_action_service",
    "github_service",
    "health_check_service",
    "human_approval_service",
    "incident_service",
    "merge_guard",
    "multi_agent_orchestrator",
    "ngrok_service",
    "remediation_orchestrator",
    "remediation_service",
    "risk_assessor",
    "rollback_service",
    "secret_sanitizer",
    "sentinel_guard",
    "slack_notification_service",
    "validation_service",
    "validator_agent",
    "webhook_relay_service",
]





