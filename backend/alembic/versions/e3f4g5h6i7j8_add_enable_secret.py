"""add enable_secret to credential_profiles

Revision ID: e3f4g5h6i7j8
Revises: d2e3f4g5h6i7
Create Date: 2026-06-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'e3f4g5h6i7j8'
down_revision = 'd2e3f4g5h6i7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'credential_profiles',
        sa.Column('enable_secret', sa.String(256), nullable=True)
    )


def downgrade():
    op.drop_column('credential_profiles', 'enable_secret')
