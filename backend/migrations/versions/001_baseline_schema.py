"""Baseline database schema for SentinelOps.

Revision ID: 001_baseline_schema
Revises: 
Create Date: 2026-09-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001_baseline_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Repositories
    op.create_table(
        "repositories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("full_name", sa.String(length=256), nullable=False),
        sa.Column("owner", sa.String(length=128), nullable=True),
        sa.Column("default_branch", sa.String(length=64), server_default="main", nullable=True),
        sa.Column("html_url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("full_name"),
    )
    with op.batch_alter_table("repositories") as batch_op:
        batch_op.create_index("ix_repositories_full_name", ["full_name"], unique=True)

    # 2. Workflow runs
    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.BigInteger(), nullable=False),
        sa.Column("repository_id", sa.Integer(), nullable=True),
        sa.Column("repo_name", sa.String(length=256), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("branch", sa.String(length=128), nullable=False),
        sa.Column("commit_sha", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("conclusion", sa.String(length=64), nullable=True),
        sa.Column("actor", sa.String(length=128), nullable=True),
        sa.Column("event_type", sa.String(length=64), server_default="workflow_run", nullable=True),
        sa.Column("html_url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["repository_id"], ["repositories.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id"),
    )
    with op.batch_alter_table("workflow_runs") as batch_op:
        batch_op.create_index("ix_workflow_runs_run_id", ["run_id"], unique=True)

    # 3. Pipeline jobs
    op.create_table(
        "pipeline_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("workflow_run_id", sa.Integer(), nullable=True),
        sa.Column("job_id", sa.BigInteger(), nullable=True),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("conclusion", sa.String(length=64), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("logs_snippet", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["workflow_run_id"], ["workflow_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 4. Incidents (Baseline columns)
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("workflow_run_id", sa.Integer(), nullable=True),
        sa.Column("repo", sa.String(length=256), nullable=False),
        sa.Column("pipeline", sa.String(length=256), nullable=False),
        sa.Column("failure", sa.String(length=256), nullable=False),
        sa.Column("rootCause", sa.String(length=512), nullable=True),
        sa.Column("confidence", sa.Integer(), server_default="0", nullable=True),
        sa.Column("confidenceColor", sa.String(length=32), server_default="primary", nullable=True),
        sa.Column("status", sa.String(length=64), server_default="Investigating", nullable=True),
        sa.Column("time", sa.String(length=64), server_default="just now", nullable=True),
        sa.Column("runId", sa.BigInteger(), nullable=True),
        sa.Column("branch", sa.String(length=128), nullable=True),
        sa.Column("commit", sa.String(length=64), nullable=True),
        sa.Column("actionLabel", sa.String(length=64), nullable=True),
        sa.Column("actionVariant", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["workflow_run_id"], ["workflow_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("incidents") as batch_op:
        batch_op.create_index("ix_incidents_repo", ["repo"], unique=False)
        batch_op.create_index("ix_incidents_runId", ["runId"], unique=False)
        batch_op.create_index("ix_incidents_status", ["status"], unique=False)

    # 5. AI Analyses
    op.create_table(
        "ai_analyses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("incident_id", sa.String(length=64), nullable=False),
        sa.Column("agent_name", sa.String(length=128), server_default="Sentinel-Core", nullable=True),
        sa.Column("category", sa.String(length=128), nullable=True),
        sa.Column("severity", sa.String(length=32), server_default="medium", nullable=True),
        sa.Column("confidence", sa.Integer(), server_default="0", nullable=True),
        sa.Column("root_cause", sa.String(length=512), nullable=False),
        sa.Column("affected_files", sa.Text(), nullable=True),
        sa.Column("recommended_fix", sa.Text(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("ai_analyses") as batch_op:
        batch_op.create_index("ix_ai_analyses_incident_id", ["incident_id"], unique=False)

    # 6. Remediations
    op.create_table(
        "remediations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("incident_id", sa.String(length=64), nullable=False),
        sa.Column("action_type", sa.String(length=128), nullable=False),
        sa.Column("policy_status", sa.String(length=64), server_default="SAFE", nullable=True),
        sa.Column("patch_diff", sa.Text(), nullable=True),
        sa.Column("branch_name", sa.String(length=128), nullable=True),
        sa.Column("test_results", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=64), server_default="pending", nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("remediations") as batch_op:
        batch_op.create_index("ix_remediations_incident_id", ["incident_id"], unique=False)

    # 7. Pull Requests
    op.create_table(
        "pull_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("repository_id", sa.Integer(), nullable=True),
        sa.Column("remediation_id", sa.Integer(), nullable=True),
        sa.Column("pr_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("branch", sa.String(length=128), nullable=False),
        sa.Column("base_branch", sa.String(length=128), server_default="main", nullable=True),
        sa.Column("status", sa.String(length=64), server_default="open", nullable=True),
        sa.Column("ai_score", sa.Integer(), server_default="95", nullable=True),
        sa.Column("html_url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["remediation_id"], ["remediations.id"]),
        sa.ForeignKeyConstraint(["repository_id"], ["repositories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("pull_requests") as batch_op:
        batch_op.create_index("ix_pull_requests_pr_number", ["pr_number"], unique=False)

    # 8. Approvals
    op.create_table(
        "approvals",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("remediation_id", sa.Integer(), nullable=False),
        sa.Column("approver", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=64), server_default="pending", nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["remediation_id"], ["remediations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("approvals") as batch_op:
        batch_op.create_index("ix_approvals_remediation_id", ["remediation_id"], unique=False)


def downgrade() -> None:
    op.drop_table("approvals")
    op.drop_table("pull_requests")
    op.drop_table("remediations")
    op.drop_table("ai_analyses")
    op.drop_table("incidents")
    op.drop_table("pipeline_jobs")
    op.drop_table("workflow_runs")
    op.drop_table("repositories")
