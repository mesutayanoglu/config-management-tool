"""add configlet_devices table and schedule fields to configlets

Revision ID: h6i7j8k9l0m1
Revises: g5h6i7j8k9l0
Create Date: 2026-06-10 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'h6i7j8k9l0m1'
down_revision = 'g5h6i7j8k9l0'
branch_labels = None
depends_on = None


def upgrade():
    # Add schedule and defaults fields to configlets
    op.add_column('configlets', sa.Column('variable_defaults', sa.Text(), nullable=True))
    op.add_column('configlets', sa.Column('schedule_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('configlets', sa.Column('schedule_type', sa.String(), nullable=True))
    op.add_column('configlets', sa.Column('interval_value', sa.Integer(), nullable=True))
    op.add_column('configlets', sa.Column('interval_unit', sa.String(), nullable=True))
    op.add_column('configlets', sa.Column('time_of_day', sa.String(), nullable=True))
    op.add_column('configlets', sa.Column('days_of_week', sa.String(), nullable=True))
    op.add_column('configlets', sa.Column('day_of_month', sa.Integer(), nullable=True))
    op.add_column('configlets', sa.Column('last_run_at', sa.DateTime(), nullable=True))

    # Create configlet_devices join table
    op.create_table(
        'configlet_devices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('configlet_id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['configlet_id'], ['configlets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_configlet_devices_id'), 'configlet_devices', ['id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_configlet_devices_id'), table_name='configlet_devices')
    op.drop_table('configlet_devices')
    op.drop_column('configlets', 'last_run_at')
    op.drop_column('configlets', 'day_of_month')
    op.drop_column('configlets', 'days_of_week')
    op.drop_column('configlets', 'time_of_day')
    op.drop_column('configlets', 'interval_unit')
    op.drop_column('configlets', 'interval_value')
    op.drop_column('configlets', 'schedule_type')
    op.drop_column('configlets', 'schedule_enabled')
    op.drop_column('configlets', 'variable_defaults')
