"""add notification_email to configlets

Revision ID: i7j8k9l0m1n2
Revises: h6i7j8k9l0m1
Create Date: 2026-06-10 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'i7j8k9l0m1n2'
down_revision = 'h6i7j8k9l0m1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('configlets', sa.Column('notification_email', sa.String(), nullable=True))


def downgrade():
    op.drop_column('configlets', 'notification_email')
