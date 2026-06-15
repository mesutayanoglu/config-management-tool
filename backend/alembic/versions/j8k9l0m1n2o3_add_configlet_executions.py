"""add configlet_executions table

Revision ID: j8k9l0m1n2o3
Revises: i7j8k9l0m1n2
Create Date: 2026-06-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'j8k9l0m1n2o3'
down_revision = 'i7j8k9l0m1n2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'configlet_executions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('configlet_id', sa.Integer(), nullable=True),
        sa.Column('configlet_name', sa.String(), nullable=False),
        sa.Column('triggered_by_id', sa.Integer(), nullable=True),
        sa.Column('triggered_by_username', sa.String(), nullable=True),
        sa.Column('trigger_type', sa.String(16), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('total_devices', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ok_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fail_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('device_results', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['configlet_id'], ['configlets.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['triggered_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_configlet_executions_id'), 'configlet_executions', ['id'], unique=False)
    op.create_index('ix_configlet_executions_started_at', 'configlet_executions', ['started_at'], unique=False)


def downgrade():
    op.drop_index('ix_configlet_executions_started_at', table_name='configlet_executions')
    op.drop_index(op.f('ix_configlet_executions_id'), table_name='configlet_executions')
    op.drop_table('configlet_executions')
