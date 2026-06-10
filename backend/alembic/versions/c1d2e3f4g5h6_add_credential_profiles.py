"""add credential profiles

Revision ID: c1d2e3f4g5h6
Revises: b2c3d4e5f6a7
Create Date: 2026-06-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4g5h6'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'credential_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('description', sa.String(256), nullable=True),
        sa.Column('username', sa.String(128), nullable=False),
        sa.Column('password', sa.String(256), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False, server_default='22'),
        sa.Column('kex_algs', sa.Text(), nullable=True),
        sa.Column('host_key_algs', sa.Text(), nullable=True),
        sa.Column('cipher_algs', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index('ix_credential_profiles_id', 'credential_profiles', ['id'])

    op.add_column(
        'devices',
        sa.Column('credential_profile_id', sa.Integer(),
                  sa.ForeignKey('credential_profiles.id'), nullable=True)
    )


def downgrade():
    op.drop_column('devices', 'credential_profile_id')
    op.drop_index('ix_credential_profiles_id', table_name='credential_profiles')
    op.drop_table('credential_profiles')
