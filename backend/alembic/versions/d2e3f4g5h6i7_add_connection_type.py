"""add connection_type to credential_profiles

Revision ID: d2e3f4g5h6i7
Revises: c1d2e3f4g5h6
Create Date: 2026-06-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'd2e3f4g5h6i7'
down_revision = 'c1d2e3f4g5h6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'credential_profiles',
        sa.Column('connection_type', sa.String(16), nullable=False, server_default='ssh')
    )


def downgrade():
    op.drop_column('credential_profiles', 'connection_type')
