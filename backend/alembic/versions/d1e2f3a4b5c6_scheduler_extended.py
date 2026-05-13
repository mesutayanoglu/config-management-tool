"""scheduler extended fields

Revision ID: d1e2f3a4b5c6
Revises: c3d4e5f6a7b8
Create Date: 2026-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'd1e2f3a4b5c6'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('schedulers', sa.Column('schedule_type', sa.String(), nullable=True))
    op.add_column('schedulers', sa.Column('interval_value', sa.Integer(), nullable=True))
    op.add_column('schedulers', sa.Column('interval_unit', sa.String(), nullable=True))
    op.add_column('schedulers', sa.Column('time_of_day', sa.String(), nullable=True))
    op.add_column('schedulers', sa.Column('days_of_week', sa.String(), nullable=True))
    op.add_column('schedulers', sa.Column('day_of_month', sa.Integer(), nullable=True))
    op.add_column('schedulers', sa.Column('target_type', sa.String(), nullable=True))
    op.add_column('schedulers', sa.Column('target_org_id', sa.Integer(), sa.ForeignKey('organizations.id'), nullable=True))
    op.add_column('schedulers', sa.Column('target_site_id', sa.Integer(), sa.ForeignKey('sites.id'), nullable=True))
    op.add_column('schedulers', sa.Column('last_run_at', sa.DateTime(), nullable=True))

    # Populate defaults for existing rows
    op.execute("""
        UPDATE schedulers SET
            schedule_type  = 'interval',
            interval_value = COALESCE(interval_minutes, 60),
            interval_unit  = 'minutes',
            target_type    = 'manual'
        WHERE schedule_type IS NULL
    """)

    op.alter_column('schedulers', 'schedule_type', nullable=False)
    op.alter_column('schedulers', 'interval_value', nullable=False)
    op.alter_column('schedulers', 'interval_unit', nullable=False)
    op.alter_column('schedulers', 'target_type', nullable=False)


def downgrade():
    op.drop_column('schedulers', 'last_run_at')
    op.drop_column('schedulers', 'target_site_id')
    op.drop_column('schedulers', 'target_org_id')
    op.drop_column('schedulers', 'target_type')
    op.drop_column('schedulers', 'day_of_month')
    op.drop_column('schedulers', 'days_of_week')
    op.drop_column('schedulers', 'time_of_day')
    op.drop_column('schedulers', 'interval_unit')
    op.drop_column('schedulers', 'interval_value')
    op.drop_column('schedulers', 'schedule_type')
