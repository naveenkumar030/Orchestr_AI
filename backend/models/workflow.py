"""
Workflow, Repository, and PipelineJob models for SentinelOps.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from models.base import SerializerMixin


class Repository(Base, SerializerMixin):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False)
    full_name = Column(String(256), unique=True, nullable=False, index=True)
    owner = Column(String(128), nullable=True)
    default_branch = Column(String(64), default="main")
    html_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    workflow_runs = relationship("WorkflowRun", back_populates="repository", cascade="all, delete-orphan")
    pull_requests = relationship("PullRequest", back_populates="repository")


class WorkflowRun(Base, SerializerMixin):
    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(BigInteger, unique=True, nullable=False, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), nullable=True)
    repo_name = Column(String(256), nullable=False)
    name = Column(String(256), nullable=False)
    branch = Column(String(128), nullable=False)
    commit_sha = Column(String(64), nullable=False)
    status = Column(String(64), nullable=False)
    conclusion = Column(String(64), nullable=True)
    actor = Column(String(128), nullable=True)
    event_type = Column(String(64), default="workflow_run")
    html_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    repository = relationship("Repository", back_populates="workflow_runs")
    jobs = relationship("PipelineJob", back_populates="workflow_run", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="workflow_run")


class PipelineJob(Base, SerializerMixin):
    __tablename__ = "pipeline_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id"), nullable=True)
    job_id = Column(BigInteger, nullable=True)
    name = Column(String(256), nullable=False)
    status = Column(String(64), nullable=False)
    conclusion = Column(String(64), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    logs_snippet = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    workflow_run = relationship("WorkflowRun", back_populates="jobs")
