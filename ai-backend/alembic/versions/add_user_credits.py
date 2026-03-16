"""Add credits to users

Revision ID: add_user_credits
Revises: 587cee0e3bd5
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_user_credits"
down_revision: Union[str, Sequence[str], None] = "587cee0e3bd5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("credits", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "credits")
