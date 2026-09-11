"""
Security package for SentinelOps.
Exports webhook signature verification utilities.
"""

from security.webhook import verify_github_signature

__all__ = ["verify_github_signature"]
