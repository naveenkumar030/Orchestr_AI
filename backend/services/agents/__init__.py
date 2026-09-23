"""
SentinelOps Multi-Agent Reasoning Package (Phase 3).
Exports the Diagnoser, FixSuggester, Critic, and MultiAgentOrchestrator.
"""

from services.agents.critic_agent import CriticAgent, critic_agent
from services.agents.diagnoser_agent import DiagnoserAgent, diagnoser_agent
from services.agents.fix_suggester_agent import FixSuggesterAgent, fix_suggester_agent
from services.agents.multi_agent_orchestrator import (
    MultiAgentOrchestrator,
    multi_agent_orchestrator,
)

__all__ = [
    "CriticAgent",
    "DiagnoserAgent",
    "FixSuggesterAgent",
    "MultiAgentOrchestrator",
    "critic_agent",
    "diagnoser_agent",
    "fix_suggester_agent",
    "multi_agent_orchestrator",
]
