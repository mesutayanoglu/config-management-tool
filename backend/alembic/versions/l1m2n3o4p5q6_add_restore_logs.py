"""add restore_logs table

Revision ID: l1m2n3o4p5q6
Revises: k9l0m1n2o3p4
Create Date: 2026-08-27 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'l1m2n3o4p5q6'
down_revision = 'k9l0m1n2o3p4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'restore_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=True),
        sa.Column('device_hostname', sa.String(), nullable=False),
        sa.Column('device_ip', sa.String(), nullable=True),
        sa.Column('triggered_by_id', sa.Integer(), nullable=True),
        sa.Column('triggered_by_username', sa.String(), nullable=True),
        sa.Column('target_sha', sa.String(), nullable=False),
        sa.Column('target_commit_message', sa.String(), nullable=True),
        sa.Column('backup_sha', sa.String(), nullable=True),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['triggered_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_restore_logs_id'), 'restore_logs', ['id'], unique=False)
    op.create_index('ix_restore_logs_started_at', 'restore_logs', ['started_at'], unique=False)


def downgrade():
    op.drop_index('ix_restore_logs_started_at', table_name='restore_logs')
    op.drop_index(op.f('ix_restore_logs_id'), table_name='restore_logs')
    op.drop_table('restore_logs')
