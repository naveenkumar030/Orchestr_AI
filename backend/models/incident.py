"""
Incident model for SentinelOps pipeline failures and anomalies.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from models.base import SerializerMixin


class Incident(Base, SerializerMixin):
    __tablename__ = "incidents"

    id = Column(String(64), primary_key=True)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id"), nullable=True)
    repo = Column(String(256), nullable=False, index=True)
    pipeline = Column(String(256), nullable=False)
    failure = Column(String(256), nullable=False)
    rootCause = Column(String(512), nullable=True)
    confidence = Column(Integer, default=0)
    confidenceColor = Column(String(32), default="primary")
    status = Column(String(64), default="Investigating", index=True)
    time = Column(String(64), default="just now")
    runId = Column(BigInteger, nullable=True, index=True)
    branch = Column(String(128), nullable=True)
    commit = Column(String(64), nullable=True)
    actionLabel = Column(String(64), nullable=True)
    actionVariant = Column(String(32), nullable=True)
    prNumber = Column(Integer, nullable=True)
    prUrl = Column(String(512), nullable=True)
    remediationBranch = Column(String(256), nullable=True)
    diff = Column(Text, nullable=True)
    agent_reasoning = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    workflow_run = relationship("WorkflowRun", back_populates="incidents")
    analyses = relationship("AIAnalysis", back_populates="incident", cascade="all, delete-orphan")
    remediations = relationship("Remediation", back_populates="incident", cascade="all, delete-orphan")

    def to_dict(self):
        d = super().to_dict()
        if d.get("agent_reasoning") and isinstance(d["agent_reasoning"], str):
            try:
                import json
                d["agent_reasoning"] = json.loads(d["agent_reasoning"])
            except Exception:
                pass
        return d
