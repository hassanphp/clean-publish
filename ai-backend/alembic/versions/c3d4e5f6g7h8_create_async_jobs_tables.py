"""create_async_jobs_tables

Revision ID: c3d4e5f6g7h8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-17

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa


revision: str = "c3d4e5f6g7h8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    inspector = inspect(conn)
    return name in inspector.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "async_jobs"):
        op.create_table(
            "async_jobs",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("pipeline_version", sa.String(length=2), nullable=False),
            sa.Column("target_studio_description", sa.Text(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_async_jobs_id", "async_jobs", ["id"], unique=False)
        op.create_index("ix_async_jobs_status", "async_jobs", ["status"], unique=False)

    if not _table_exists(conn, "async_job_images"):
        op.create_table(
            "async_job_images",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("job_id", sa.String(length=36), nullable=False),
            sa.Column("image_index", sa.Integer(), nullable=False),
            sa.Column("provider_job_id", sa.String(length=255), nullable=True),
            sa.Column("provider", sa.String(length=32), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("original_b64", sa.Text(), nullable=True),
            sa.Column("processed_b64", sa.Text(), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["job_id"], ["async_jobs.id"], ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_async_job_images_job_id", "async_job_images", ["job_id"], unique=False)
        op.create_index("ix_async_job_images_provider_job_id", "async_job_images", ["provider_job_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_async_job_images_provider_job_id", table_name="async_job_images")
    op.drop_index("ix_async_job_images_job_id", table_name="async_job_images")
    op.drop_table("async_job_images")
    op.drop_index("ix_async_jobs_status", table_name="async_jobs")
    op.drop_index("ix_async_jobs_id", table_name="async_jobs")
    op.drop_table("async_jobs")
