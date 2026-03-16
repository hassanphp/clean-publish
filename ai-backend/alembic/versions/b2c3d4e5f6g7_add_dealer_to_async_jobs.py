"""add_dealer_to_async_jobs

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-14

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa


revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6g7h8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(conn, table: str, col: str) -> bool:
    insp = inspect(conn)
    cols = [c["name"] for c in insp.get_columns(table)]
    return col in cols


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "async_jobs", "dealer_id"):
        op.add_column("async_jobs", sa.Column("dealer_id", sa.Integer(), nullable=True))
    if not _has_column(conn, "async_jobs", "branding_options_json"):
        op.add_column("async_jobs", sa.Column("branding_options_json", sa.Text(), nullable=True))
    # Check index exists (SQLite creates implicitly for unique, we add explicit for queries)
    try:
        op.create_index("ix_async_jobs_dealer_id", "async_jobs", ["dealer_id"], unique=False)
    except Exception:
        pass  # Index may already exist


def downgrade() -> None:
    op.drop_index("ix_async_jobs_dealer_id", table_name="async_jobs", if_exists=True)
    op.drop_column("async_jobs", "branding_options_json")
    op.drop_column("async_jobs", "dealer_id")
