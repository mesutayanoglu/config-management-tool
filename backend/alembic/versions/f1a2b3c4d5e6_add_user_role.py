"""add user role column and bootstrap first super_administrator

Revision ID: f1a2b3c4d5e6
Revises: e2f3a4b5c6d7
Create Date: 2026-05-14 10:00:00.000000
"""
import os

import bcrypt
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    # 1) role kolonu ekle — server_default ile mevcut satırlar 'admin' alır
    op.add_column(
        'users',
        sa.Column('role', sa.String(32), nullable=False, server_default='admin'),
    )

    # 2) Mevcut is_admin verisini role'e aktar
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE users SET role = 'super_administrator' WHERE is_admin = TRUE"))
    conn.execute(sa.text("UPDATE users SET role = 'admin' WHERE is_admin = FALSE OR is_admin IS NULL"))

    # 3) Bootstrap: super_administrator yoksa ve env var'lar tanımlıysa ilk kullanıcıyı oluştur
    initial_username = os.environ.get('INITIAL_SUPERADMIN_USERNAME', '').strip()
    initial_password = os.environ.get('INITIAL_SUPERADMIN_PASSWORD', '').strip()

    if initial_username and initial_password:
        result = conn.execute(
            sa.text("SELECT COUNT(*) FROM users WHERE role = 'super_administrator'")
        )
        count = result.scalar()
        if count == 0:
            hashed = bcrypt.hashpw(initial_password.encode(), bcrypt.gensalt()).decode()
            conn.execute(
                sa.text(
                    "INSERT INTO users (username, hashed_password, is_admin, is_active, role) "
                    "VALUES (:username, :hashed_password, TRUE, TRUE, 'super_administrator')"
                ),
                {"username": initial_username, "hashed_password": hashed},
            )


def downgrade():
    op.drop_column('users', 'role')
