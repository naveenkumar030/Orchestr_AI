"""
Routes package for SentinelOps.
Registers all Blueprint modules into the Flask application.
"""

from routes.health import health_bp
from routes.webhooks import webhooks_bp
from routes.github import github_bp
from routes.reliability import reliability_bp


def register_routes(app):
    """
    Registers all SentinelOps Blueprints.

    Called once from app.py after the Flask app is created.
    Existing inline routes in app.py continue to work — Blueprints
    are additive, not replacements, during the incremental migration.
    """
    app.register_blueprint(health_bp)
    app.register_blueprint(webhooks_bp)
    app.register_blueprint(github_bp)
    app.register_blueprint(reliability_bp)

