"""add mfa fields to users

Revision ID: f4g5h6i7j8k9
Revises: e3f4g5h6i7j8
Create Date: 2026-06-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'f4g5h6i7j8k9'
down_revision = 'e3f4g5h6i7j8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('totp_secret', sa.String(64), nullable=True))
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('users', 'mfa_enabled')
    op.drop_column('users', 'totp_secret')
