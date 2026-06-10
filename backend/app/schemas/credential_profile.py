from pydantic import BaseModel
from typing import Literal


class CredentialProfileCreate(BaseModel):
    name: str
    description: str | None = None
    connection_type: Literal["ssh", "telnet"] = "ssh"
    username: str
    password: str
    port: int = 22
    enable_secret: str | None = None
    kex_algs: list[str] | None = None
    host_key_algs: list[str] | None = None
    cipher_algs: list[str] | None = None


class CredentialProfileUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    connection_type: Literal["ssh", "telnet"] | None = None
    username: str | None = None
    password: str | None = None
    port: int | None = None
    enable_secret: str | None = None
    kex_algs: list[str] | None = None
    host_key_algs: list[str] | None = None
    cipher_algs: list[str] | None = None


class CredentialProfileOut(BaseModel):
    id: int
    name: str
    description: str | None
    connection_type: str
    username: str
    port: int
    enable_secret: str | None
    kex_algs: list[str] | None
    host_key_algs: list[str] | None
    cipher_algs: list[str] | None

    model_config = {"from_attributes": True}
