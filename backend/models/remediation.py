"""
Remediation, PullRequest, and Approval models for SentinelOps.
"""

from datetime import datetime, timezone

from database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from models.base import SerializerMixin


class Remediation(Base, SerializerMixin):
    __tablename__ = "remediations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False, index=True)
    action_type = Column(String(128), nullable=False)
    policy_status = Column(String(64), default="SAFE")
    patch_diff = Column(Text, nullable=True)
    branch_name = Column(String(128), nullable=True)
    test_results = Column(Text, nullable=True)
    status = Column(String(64), default="pending")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    incident = relationship("Incident", back_populates="remediations")
    pull_request = relationship("PullRequest", back_populates="remediation", uselist=False)
    approvals = relationship("Approval", back_populates="remediation", cascade="all, delete-orphan")


class PullRequest(Base, SerializerMixin):
    __tablename__ = "pull_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), nullable=True)
    remediation_id = Column(Integer, ForeignKey("remediations.id"), nullable=True)
    pr_number = Column(Integer, nullable=False, index=True)
    title = Column(String(256), nullable=False)
    branch = Column(String(128), nullable=False)
    base_branch = Column(String(128), default="main")
    status = Column(String(64), default="open")
    ai_score = Column(Integer, default=95)
    html_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    repository = relationship("Repository", back_populates="pull_requests")
    remediation = relationship("Remediation", back_populates="pull_request")


class Approval(Base, SerializerMixin):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    remediation_id = Column(Integer, ForeignKey("remediations.id"), nullable=False, index=True)
    approver = Column(String(128), nullable=False)
    status = Column(String(64), default="pending")
    comments = Column(Text, nullable=True)
    decided_at = Column(DateTime, nullable=True)

    remediation = relationship("Remediation", back_populates="approvals")
