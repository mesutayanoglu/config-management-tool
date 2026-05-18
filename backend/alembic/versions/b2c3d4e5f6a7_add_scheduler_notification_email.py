"""add notification_email to schedulers

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-18 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('schedulers', sa.Column('notification_email', sa.String(), nullable=True))


def downgrade():
    op.drop_column('schedulers', 'notification_email')
