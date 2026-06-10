from sqlalchemy import Column, Integer, String, Text
from app.core.database import Base


class CredentialProfile(Base):
    __tablename__ = "credential_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), unique=True, nullable=False)
    description = Column(String(256), nullable=True)
    connection_type = Column(String(16), default="ssh", nullable=False)
    username = Column(String(128), nullable=False)
    password = Column(String(256), nullable=False)
    port = Column(Integer, default=22, nullable=False)
    enable_secret = Column(String(256), nullable=True)
    # JSON arrays stored as text; null = use Paramiko defaults (SSH only)
    kex_algs = Column(Text, nullable=True)
    host_key_algs = Column(Text, nullable=True)
    cipher_algs = Column(Text, nullable=True)
