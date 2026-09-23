import os
import time
import json
import random
import threading
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import logging
import config

class DeploymentMixin:
    def get_deployments(self, limit=50):
        try:
            from services.mongo_service import mongo_service
            if mongo_service.is_connected():
                m_deps = mongo_service.get_deployments(limit=limit)
                if m_deps:
                    for d in m_deps:
                        if not any(x.get("deployment_id") == d.get("deployment_id") for x in self.deployments):
                            self.deployments.append(d)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)
        return self.deployments[:limit]

    def get_deployment(self, deployment_id):
        for d in self.deployments:
            if d.get("deployment_id") == deployment_id:
                return d
        try:
            from services.mongo_service import mongo_service
            if mongo_service.is_connected():
                return mongo_service.get_deployment(deployment_id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)
        return None

    def get_deployment_by_incident(self, incident_id):
        for d in self.deployments:
            if d.get("incident_id") == incident_id:
                return d
        return None

    def save_deployment(self, deployment_record):
        dep_id = deployment_record.get("deployment_id")
        existing_idx = next((i for i, d in enumerate(self.deployments) if d.get("deployment_id") == dep_id), None)
        if existing_idx is not None:
            self.deployments[existing_idx].update(deployment_record)
        else:
            self.deployments.insert(0, deployment_record)

        try:
            from services.mongo_service import mongo_service
            if mongo_service.is_connected():
                mongo_service.save_deployment(deployment_record)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)

        return deployment_record

    def get_rollbacks(self, limit=50):
        try:
            from services.mongo_service import mongo_service
            if mongo_service.is_connected():
                m_rbs = mongo_service.get_rollbacks(limit=limit)
                if m_rbs:
                    for r in m_rbs:
                        if not any(x.get("rollback_id") == r.get("rollback_id") for x in self.rollbacks):
                            self.rollbacks.append(r)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)
        return self.rollbacks[:limit]

    def get_rollback(self, rollback_id):
        for r in self.rollbacks:
            if r.get("rollback_id") == rollback_id:
                return r
        return None

    def save_rollback(self, rollback_record):
        rb_id = rollback_record.get("rollback_id")
        existing_idx = next((i for i, r in enumerate(self.rollbacks) if r.get("rollback_id") == rb_id), None)
        if existing_idx is not None:
            self.rollbacks[existing_idx].update(rollback_record)
        else:
            self.rollbacks.insert(0, rollback_record)

        try:
            from services.mongo_service import mongo_service
            if mongo_service.is_connected():
                mongo_service.save_rollback(rollback_record)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error('Exception in data_store', exc_info=True)

        return rollback_record

