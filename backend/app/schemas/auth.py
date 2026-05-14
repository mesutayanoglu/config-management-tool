from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: int
    username: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class UserCreate(BaseModel):
    username: str
    password: str
    email: str | None = None
    role: str = 'admin'


class UserOut(BaseModel):
    id: int
    username: str
    email: str | None
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class UserUpdatePassword(BaseModel):
    new_password: str
    current_password: str | None = None


class UserUpdateRole(BaseModel):
    role: str


class UserUpdateProfile(BaseModel):
    username: str | None = None
    email: str | None = None


class PasswordResetRequest(BaseModel):
    username: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
