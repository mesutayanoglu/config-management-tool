"""make interval_minutes nullable with default

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-01-01 00:01:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('schedulers', 'interval_minutes',
                    existing_type=sa.Integer(),
                    nullable=True,
                    server_default='60')


def downgrade():
    op.alter_column('schedulers', 'interval_minutes',
                    existing_type=sa.Integer(),
                    nullable=False,
                    server_default=None)
