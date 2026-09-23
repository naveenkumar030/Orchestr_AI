"""
AI Analysis and Root Cause Analysis (RCA) model for SentinelOps.
"""

from datetime import datetime, timezone

from database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from models.base import SerializerMixin


class AIAnalysis(Base, SerializerMixin):
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False, index=True)
    agent_name = Column(String(128), default="Sentinel-Core")
    category = Column(String(128), nullable=True)
    severity = Column(String(32), default="medium")
    confidence = Column(Integer, default=0)
    root_cause = Column(String(512), nullable=False)
    affected_files = Column(Text, nullable=True)
    recommended_fix = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    incident = relationship("Incident", back_populates="analyses")
