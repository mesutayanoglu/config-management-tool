"""add topology_neighbors table

Revision ID: k9l0m1n2o3p4
Revises: j8k9l0m1n2o3
Create Date: 2026-06-17 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'k9l0m1n2o3p4'
down_revision = 'j8k9l0m1n2o3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'topology_neighbors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('neighbor_hostname', sa.String(), nullable=True),
        sa.Column('neighbor_ip', sa.String(), nullable=True),
        sa.Column('local_port', sa.String(), nullable=True),
        sa.Column('neighbor_port', sa.String(), nullable=True),
        sa.Column('protocol', sa.String(10), nullable=True, server_default='lldp'),
        sa.Column('discovered_device_id', sa.Integer(), nullable=True),
        sa.Column('last_discovered_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['discovered_device_id'], ['devices.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_topology_neighbors_id', 'topology_neighbors', ['id'])
    op.create_index('ix_topology_neighbors_device_id', 'topology_neighbors', ['device_id'])


def downgrade():
    op.drop_index('ix_topology_neighbors_device_id', table_name='topology_neighbors')
    op.drop_index('ix_topology_neighbors_id', table_name='topology_neighbors')
    op.drop_table('topology_neighbors')
