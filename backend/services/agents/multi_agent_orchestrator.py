"""
Multi-Agent Orchestrator for SentinelOps (Phase 3 Multi-Agent Reasoning).
Coordinates the 3-agent cooperative reasoning chain:
Log Fetcher -> Diagnoser -> FixSuggester -> Critic / Verifier (Refinement Loop up to 3 attempts) -> Final Decision.
"""

import os
import time
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import config
from services.secret_sanitizer import secret_sanitizer
from services.agents.diagnoser_agent import diagnoser_agent, DiagnoserAgent
from services.agents.fix_suggester_agent import fix_suggester_agent, FixSuggesterAgent
from services.agents.critic_agent import critic_agent, CriticAgent


class MultiAgentOrchestrator:
    """
    Orchestrates the multi-agent reasoning chain and manages the refinement loop.
    Enforces a strict maximum of 3 refinement attempts before escalating to human review.
    """

    MAX_ATTEMPTS = 3

    def __init__(
        self,
        diagnoser: Optional[DiagnoserAgent] = None,
        fix_suggester: Optional[FixSuggesterAgent] = None,
        critic: Optional[CriticAgent] = None,
    ):
        self.diagnoser = diagnoser or diagnoser_agent
        self.fix_suggester = fix_suggester or fix_suggester_agent
        self.critic = critic or critic_agent

    def execute_reasoning_pipeline(
        self,
        logs: str,
        repository: str = "SentinelOps",
        workflow_name: str = "CI/CD Workflow",
        job_name: Optional[str] = None,
        failed_step: Optional[str] = None,
        commit_sha: str = "HEAD",
        repo_context: Optional[Dict[str, str]] = None,
        incident_id: Optional[str] = None,
        max_attempts: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Executes the end-to-end multi-agent reasoning workflow.
        Returns the final structured agent result with full telemetry.
        """
        start_time_all = time.perf_counter()
        now_iso = datetime.now(timezone.utc).isoformat()
        clean_commit = commit_sha[:7] if len(commit_sha) >= 7 else commit_sha
        inc_id = incident_id or f"INC-{int(time.time())}"
        effective_max_attempts = max_attempts or self.MAX_ATTEMPTS
        pipeline_timeout_seconds = float(getattr(config, "SENTINEL_AGENT_TIMEOUT_SECONDS", 60.0))

        agent_timeline: List[Dict[str, Any]] = []
        refinement_history: List[Dict[str, Any]] = []

        # ── Step 1: Log Fetcher & Sanitizer ──────────────────────────────────
        t0 = time.perf_counter()
        sanitized_logs = secret_sanitizer.sanitize_text(logs)
        safe_repo_context = secret_sanitizer.sanitize_repo_context(repo_context or {})
        t_log_fetch = int((time.perf_counter() - t0) * 1000)

        agent_timeline.append({
            "agent": "Log Fetcher",
            "role": "Telemetry & Secret Sanitization",
            "status": "completed",
            "duration_ms": max(t_log_fetch, 1),
            "input_summary": f"Ingested runner logs for {repository}@{clean_commit}",
            "output_summary": f"Sanitized {len(sanitized_logs)} bytes of log stream. Masked tokens/secrets and filtered sensitive config files.",
            "error": None,
        })

        # ── Step 2: Diagnoser Agent ──────────────────────────────────────────
        t0 = time.perf_counter()
        try:
            diagnosis = self.diagnoser.diagnose(
                logs=sanitized_logs,
                repository=repository,
                workflow_name=workflow_name,
                job_name=job_name,
                failed_step=failed_step,
                commit_sha=clean_commit,
                repo_context=safe_repo_context,
            )
            diag_status = "completed"
            diag_error = None
        except Exception as ex:
            diagnosis = {
                "category": "unknown",
                "root_cause": f"Diagnosis failed with error: {str(ex)}",
                "confidence": 0.20,
                "evidence": [str(ex)],
                "affected_files": [],
                "affected_components": [],
                "suggested_fix_direction": "Perform manual log inspection",
            }
            diag_status = "error"
            diag_error = str(ex)

        t_diag = int((time.perf_counter() - t0) * 1000)
        agent_timeline.append({
            "agent": "Diagnoser",
            "role": "Root-Cause Analysis & Taxonomy",
            "status": diag_status,
            "duration_ms": max(t_diag, 1),
            "confidence": diagnosis.get("confidence", 0.0),
            "input_summary": f"Sanitized logs ({len(sanitized_logs)} bytes) + {len(safe_repo_context)} repo context files",
            "output_summary": f"Category: {diagnosis.get('category')} | Root Cause: {diagnosis.get('root_cause')} (Confidence: {int(diagnosis.get('confidence', 0)*100)}%)",
            "error": diag_error,
        })

        # ── Step 3 & 4: FixSuggester <-> Critic Refinement Loop ───────────────
        final_fix: Dict[str, Any] = {}
        final_critic: Dict[str, Any] = {}
        critic_feedback: Optional[Dict[str, Any]] = None
        final_status = "human_review_required"
        completed_attempts = 0

        for attempt_num in range(1, effective_max_attempts + 1):
            # Check pipeline execution deadline
            if (time.perf_counter() - start_time_all) > pipeline_timeout_seconds:
                agent_timeline.append({
                    "agent": "Execution Watchdog",
                    "role": "Bounded Timeouts & Fail-Closed Protection",
                    "status": "timeout",
                    "duration_ms": int((time.perf_counter() - start_time_all) * 1000),
                    "input_summary": f"Pipeline execution deadline reached ({pipeline_timeout_seconds}s limit)",
                    "output_summary": "Enforced fail-closed safety policy -> Escalated to human review required",
                    "error": f"Execution deadline exceeded ({pipeline_timeout_seconds}s)",
                })
                final_status = "human_review_required"
                break

            completed_attempts = attempt_num
            t_attempt_start = time.perf_counter()

            # 3a. FixSuggester generates patch
            t_fix_start = time.perf_counter()
            try:
                fix = self.fix_suggester.suggest_fix(
                    failure_log=sanitized_logs,
                    diagnosis=diagnosis,
                    repo_context=safe_repo_context,
                    critic_feedback=critic_feedback,
                )
                fix_status = "completed"
                fix_error = None
            except Exception as ex:
                fix = {
                    "fix_type": "unknown",
                    "description": f"Fix synthesis failed: {str(ex)}",
                    "affected_files": diagnosis.get("affected_files", ["src/app.py"]),
                    "patch": "",
                    "reason": str(ex),
                    "confidence": 0.30,
                }
                fix_status = "error"
                fix_error = str(ex)

            t_fix_dur = int((time.perf_counter() - t_fix_start) * 1000)
            final_fix = fix

            agent_timeline.append({
                "agent": f"FixSuggester (Attempt #{attempt_num})",
                "role": "Targeted Unified Diff Patch Synthesis",
                "status": fix_status,
                "duration_ms": max(t_fix_dur, 1),
                "confidence": fix.get("confidence", 0.0),
                "input_summary": f"Diagnosis ({diagnosis.get('category')})" + (f" + Critic Feedback ({len(critic_feedback.get('issues', []))} issues)" if critic_feedback else ""),
                "output_summary": f"Type: {fix.get('fix_type')} | Files: {', '.join(fix.get('affected_files', []))} | Description: {fix.get('description')}",
                "error": fix_error,
            })

            # 3b. Critic / Verifier evaluates proposed patch
            t_crit_start = time.perf_counter()
            try:
                critic_res = self.critic.evaluate_fix(
                    failure_log=sanitized_logs,
                    diagnosis=diagnosis,
                    proposed_fix=fix,
                    repo_context=safe_repo_context,
                )
                crit_status = "completed"
                crit_error = None
            except Exception as ex:
                critic_res = {
                    "approved": False,
                    "score": 0.25,
                    "issues": [f"Critic evaluation error: {str(ex)}"],
                    "reason": "Evaluation raised an unhandled exception",
                    "recommended_changes": ["Verify fix syntax manually"],
                    "security_concerns": [],
                    "requires_human_review": True,
                }
                crit_status = "error"
                crit_error = str(ex)

            t_crit_dur = int((time.perf_counter() - t_crit_start) * 1000)
            final_critic = critic_res

            agent_timeline.append({
                "agent": f"Critic / Verifier (Attempt #{attempt_num})",
                "role": "Adversarial Code Review & Security Audit",
                "status": crit_status,
                "duration_ms": max(t_crit_dur, 1),
                "score": critic_res.get("score", 0.0),
                "approved": critic_res.get("approved", False),
                "input_summary": f"Proposed patch for {', '.join(fix.get('affected_files', []))} ({len(fix.get('patch', '').splitlines())} diff lines)",
                "output_summary": f"Decision: {'APPROVED' if critic_res.get('approved') else 'REJECTED'} (Score: {int(critic_res.get('score', 0)*100)}%) | {critic_res.get('reason')}",
                "error": crit_error,
            })

            attempt_record = {
                "attempt_number": attempt_num,
                "fix": fix,
                "critic": critic_res,
                "approved": critic_res.get("approved", False),
                "duration_ms": int((time.perf_counter() - t_attempt_start) * 1000),
            }
            refinement_history.append(attempt_record)

            # 3c. Check approval
            if critic_res.get("approved"):
                final_status = "approved"
                break
            else:
                # Set feedback for next attempt
                critic_feedback = critic_res

        # ── Step 4: Deterministic Risk Assessment ─────────────────────────────
        from services.risk_assessor import risk_assessor
        from services.confidence_gate import confidence_gate
        from services.human_approval_service import human_approval_service

        remediation_branch = f"sentinelops/fix-{clean_commit}"
        t_risk_start = time.perf_counter()
        risk_result = risk_assessor.assess(
            patch=final_fix.get("patch", ""),
            affected_files=final_fix.get("affected_files", []),
            target_branch=remediation_branch,
            fix_type=final_fix.get("fix_type", "code"),
            diagnoser_category=diagnosis.get("category", "unknown"),
            repository_context=safe_repo_context,
        )
        t_risk_dur = int((time.perf_counter() - t_risk_start) * 1000)

        agent_timeline.append({
            "agent": "Risk Assessor",
            "role": "Deterministic Blast Radius & Safety Analysis",
            "status": "completed",
            "duration_ms": max(t_risk_dur, 1),
            "risk_level": risk_result.get("risk_level", "low"),
            "input_summary": f"Analyzed patch ({risk_result['diff_stats']['total_lines']} lines) across {len(final_fix.get('affected_files', []))} file(s)",
            "output_summary": f"Risk Level: {risk_result.get('risk_level', 'low').upper()} | Factors: {len(risk_result.get('factors', []))} | Destructive: {risk_result.get('destructive_patterns_detected', False)}",
            "error": None,
        })

        # ── Step 5: Centralized Confidence Gate & SentinelGuard ──────────────
        t_gate_start = time.perf_counter()
        safety_decision = confidence_gate.evaluate(
            diagnosis=diagnosis,
            fix=final_fix,
            critic=final_critic,
            risk_assessment=risk_result,
            target_branch=remediation_branch,
            patch=final_fix.get("patch", ""),
        )
        t_gate_dur = int((time.perf_counter() - t_gate_start) * 1000)

        # The deterministic Confidence Gate determines final safety status
        safety_status = safety_decision.get("decision", "human_review_required")

        agent_timeline.append({
            "agent": "Confidence Gate",
            "role": "Deterministic Multi-Metric Threshold & Policy Gate",
            "status": "completed",
            "duration_ms": max(t_gate_dur, 1),
            "decision": safety_status,
            "approval_status": safety_decision.get("approval_status"),
            "input_summary": f"Diag: {int(safety_decision.get('diagnosis_confidence', 0)*100)}% | Fix: {int(safety_decision.get('fix_confidence', 0)*100)}% | Critic: {int(safety_decision.get('critic_score', 0)*100)}% | Risk: {safety_decision.get('risk_level', 'low').upper()}",
            "output_summary": f"Decision: {safety_status.upper()} | Status: {safety_decision.get('approval_status')} | {'; '.join(safety_decision.get('reasons', []))}",
            "error": None,
        })

        # ── Step 6: Human Approval Gate Initialization ────────────────────────
        approval_record = human_approval_service.initialize_record(
            incident_id=inc_id,
            safety_gate_result=safety_decision,
            run_id=None,
            repo=repository,
            workflow_name=workflow_name,
        )

        agent_timeline.append({
            "agent": "Human Approval Gate",
            "role": "State Machine & Operator Authority Gate",
            "status": "completed",
            "duration_ms": 1,
            "approval_status": approval_record.get("approval_status"),
            "input_summary": f"Automated decision: {safety_status.upper()}",
            "output_summary": f"State: {approval_record.get('approval_status').upper()} | Required: {safety_decision.get('requires_human_review', False)}",
            "error": None,
        })

        total_duration_ms = int((time.perf_counter() - start_time_all) * 1000)

        # ── Step 7: Final Pipeline Consensus Summary ──────────────────────────
        agent_timeline.append({
            "agent": "Final Decision",
            "role": "Pipeline Consensus Gate",
            "status": "completed",
            "duration_ms": 1,
            "final_status": safety_status,
            "input_summary": f"Consensus evaluation across {completed_attempts} refinement attempt(s)",
            "output_summary": f"Status: {final_status.upper()} | Safety: {safety_status.upper()} | Approval: {approval_record.get('approval_status')}",
            "error": None,
        })

        error_sig = diagnosis.get("error_signature", "")
        is_cached = diagnosis.get("cached", False)

        result = {
            "status": final_status,
            "final_status": safety_status,
            "approval_status": approval_record.get("approval_status"),
            "incident_id": inc_id,
            "repository": repository,
            "workflow_name": workflow_name,
            "commit_sha": clean_commit,
            "error_signature": error_sig,
            "timestamp": now_iso,
            "diagnosis": diagnosis,
            "fix": final_fix,
            "critic": final_critic,
            "risk_assessment": risk_result,
            "safety_gate": safety_decision,
            "human_approval": approval_record,
            "attempts": completed_attempts,
            "refinement_history": refinement_history,
            "agent_timeline": agent_timeline,
            "resilience_metadata": {
                "error_signature": error_sig,
                "cached_diagnosis": is_cached,
                "pipeline_deadline_seconds": pipeline_timeout_seconds,
            },
            "execution_metrics": {
                "total_duration_ms": total_duration_ms,
                "attempts_count": completed_attempts,
                "final_critic_score": final_critic.get("score", 0.0),
                "is_approved": safety_status == "approved",
                "requires_human_review": safety_decision.get("requires_human_review", False) or final_status == "human_review_required" or final_critic.get("requires_human_review", False),
                "risk_level": risk_result.get("risk_level", "low"),
                "approval_status": approval_record.get("approval_status"),
                "error_signature": error_sig,
                "cached_diagnosis": is_cached,
            },
        }

        # Step 8: Persist result in data store
        self._persist_reasoning_record(inc_id, result)

        return result

    def _persist_reasoning_record(self, incident_id: str, record: Dict[str, Any]) -> None:
        """
        Stores the multi-agent reasoning result in the operational data store and database.
        """
        try:
            from data_store import store
            store.save_agent_reasoning(incident_id, record)
        except Exception:
            pass


multi_agent_orchestrator = MultiAgentOrchestrator()

