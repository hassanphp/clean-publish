"""create_dealers_tables

Revision ID: a1b2c3d4e5f6
Revises: 625352dfd36c
Create Date: 2026-03-14

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "625352dfd36c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    inspector = inspect(conn)
    return name in inspector.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "dealers"):
        op.create_table(
            "dealers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_dealers_email"), "dealers", ["email"], unique=True)
        op.create_index(op.f("ix_dealers_id"), "dealers", ["id"], unique=False)

    if not _table_exists(conn, "dealer_preferences"):
        op.create_table(
            "dealer_preferences",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("dealer_id", sa.Integer(), nullable=False),
            sa.Column("logo_corner_enabled", sa.Boolean(), default=False),
            sa.Column("logo_corner_position", sa.String(length=16), default="right"),
            sa.Column("license_plate_enabled", sa.Boolean(), default=False),
            sa.Column("logo_3d_wall_enabled", sa.Boolean(), default=False),
            sa.Column("default_studio_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["dealer_id"], ["dealers.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_dealer_preferences_dealer_id"), "dealer_preferences", ["dealer_id"], unique=True)

    if not _table_exists(conn, "dealer_assets"):
        op.create_table(
            "dealer_assets",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("dealer_id", sa.Integer(), nullable=False),
            sa.Column("asset_type", sa.String(length=32), nullable=False),
            sa.Column("file_path", sa.Text(), nullable=True),
            sa.Column("data_b64", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["dealer_id"], ["dealers.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_dealer_assets_dealer_id"), "dealer_assets", ["dealer_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_dealer_assets_dealer_id"), table_name="dealer_assets")
    op.drop_table("dealer_assets")
    op.drop_index(op.f("ix_dealer_preferences_dealer_id"), table_name="dealer_preferences")
    op.drop_table("dealer_preferences")
    op.drop_index(op.f("ix_dealers_id"), table_name="dealers")
    op.drop_index(op.f("ix_dealers_email"), table_name="dealers")
    op.drop_table("dealers")
