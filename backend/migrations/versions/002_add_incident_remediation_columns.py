"""Add incident remediation columns to incidents table.

Revision ID: 002_add_incident_remediation_columns
Revises: 001_baseline_schema
Create Date: 2026-09-23 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002_add_incident_remediation_columns"
down_revision: Union[str, None] = "001_baseline_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for SQLite compatibility
    with op.batch_alter_table("incidents") as batch_op:
        batch_op.add_column(sa.Column("prNumber", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("prUrl", sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column("remediationBranch", sa.String(length=256), nullable=True))
        batch_op.add_column(sa.Column("diff", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("agent_reasoning", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("source", sa.String(length=32), server_default="webhook", nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("incidents") as batch_op:
        batch_op.drop_column("source")
        batch_op.drop_column("agent_reasoning")
        batch_op.drop_column("diff")
        batch_op.drop_column("remediationBranch")
        batch_op.drop_column("prUrl")
        batch_op.drop_column("prNumber")
