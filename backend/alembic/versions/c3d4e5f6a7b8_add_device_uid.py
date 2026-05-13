"""add_device_uid

Revision ID: c3d4e5f6a7b8
Revises: 413b898c209e
Create Date: 2026-05-13 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = '413b898c209e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('devices', sa.Column('device_uid', sa.String(12), nullable=True))
    # Mevcut kayıtlara rastgele UID üret
    op.execute("UPDATE devices SET device_uid = SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT), 1, 12)")
    op.alter_column('devices', 'device_uid', nullable=False)
    op.create_unique_constraint('uq_devices_device_uid', 'devices', ['device_uid'])
    op.create_index('ix_devices_device_uid', 'devices', ['device_uid'])


def downgrade() -> None:
    op.drop_index('ix_devices_device_uid', table_name='devices')
    op.drop_constraint('uq_devices_device_uid', 'devices', type_='unique')
    op.drop_column('devices', 'device_uid')
