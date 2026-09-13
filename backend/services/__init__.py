"""
Services package for SentinelOps.
Exports singleton service instances for use by routes and agents.
"""

from services.github_service import github_service
from services.incident_service import incident_service
from services.remediation_service import remediation_service
from services.webhook_relay import webhook_relay_service
from services.ngrok_service import ngrok_service
from services.sentinel_guard import sentinel_guard
from services.validation_service import validation_service
from services.validator_agent import validator_agent
from services.merge_guard import merge_guard
from services.remediation_orchestrator import remediation_orchestrator
from services.deployment_service import deployment_service
from services.health_check_service import health_check_service
from services.deployment_guard import deployment_guard
from services.rollback_service import rollback_service
from services.secret_sanitizer import secret_sanitizer
from services.risk_assessor import risk_assessor, RiskAssessor
from services.confidence_gate import confidence_gate, ConfidenceGate, CONFIDENCE_GATE_CONFIG
from services.human_approval_service import human_approval_service, HumanApprovalService
from services.slack_notification_service import slack_notification_service, SlackNotificationService
from services.github_action_service import github_action_service, GitHubActionService
from services.agents import diagnoser_agent, fix_suggester_agent, critic_agent, multi_agent_orchestrator

__all__ = [
    "github_service",
    "incident_service",
    "remediation_service",
    "webhook_relay_service",
    "ngrok_service",
    "sentinel_guard",
    "validation_service",
    "validator_agent",
    "merge_guard",
    "remediation_orchestrator",
    "deployment_service",
    "health_check_service",
    "deployment_guard",
    "rollback_service",
    "secret_sanitizer",
    "risk_assessor",
    "RiskAssessor",
    "confidence_gate",
    "ConfidenceGate",
    "CONFIDENCE_GATE_CONFIG",
    "human_approval_service",
    "HumanApprovalService",
    "slack_notification_service",
    "SlackNotificationService",
    "github_action_service",
    "GitHubActionService",
    "diagnoser_agent",
    "fix_suggester_agent",
    "critic_agent",
    "multi_agent_orchestrator",
]





