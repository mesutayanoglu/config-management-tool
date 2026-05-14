import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    create_access_token, hash_password, verify_password,
    get_current_user, get_super_admin_user,
)
from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.schemas.auth import (
    LoginRequest, TokenResponse, UserCreate, UserOut, UserInfo,
    UserUpdatePassword, UserUpdateRole, UserUpdateProfile,
    PasswordResetRequest, PasswordResetConfirm,
)

router = APIRouter()

VALID_ROLES = {'super_administrator', 'admin', 'read_only'}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Hatalı kullanıcı adı veya şifre")
    token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role})
    return TokenResponse(
        access_token=token,
        user=UserInfo(id=user.id, username=user.username, role=user.role),
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_super_admin_user),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz rol")
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kullanıcı adı zaten mevcut")
    if len(body.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Şifre en az 6 karakter olmalıdır")
    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        is_admin=(body.role == 'super_administrator'),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_super_admin_user),
):
    result = await db.execute(select(User))
    return result.scalars().all()


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kendi hesabınızı silemezsiniz")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")

    if user.role == 'super_administrator':
        count_result = await db.execute(
            select(User).where(User.role == 'super_administrator', User.is_active == True)
        )
        if len(count_result.scalars().all()) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sistemde en az bir super administrator kalmalıdır",
            )

    await db.delete(user)
    await db.commit()


@router.put("/users/{user_id}/profile", response_model=UserOut)
async def update_profile(
    user_id: int,
    body: UserUpdateProfile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id != user_id and current_user.role != 'super_administrator':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetki yok")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")

    if body.username is not None:
        new_username = body.username.strip()
        if new_username and new_username != target.username:
            existing = await db.execute(select(User).where(User.username == new_username))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kullanıcı adı zaten kullanımda")
            target.username = new_username

    if body.email is not None:
        target.email = body.email.strip() or None

    await db.commit()
    await db.refresh(target)
    return target


@router.put("/users/{user_id}/password", status_code=status.HTTP_200_OK)
async def update_password(
    user_id: int,
    body: UserUpdatePassword,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")

    if current_user.id != user_id:
        if current_user.role != 'super_administrator':
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetki yok")
    else:
        # Kendi şifresini değiştiriyor — super_admin hariç current_password zorunlu
        if current_user.role != 'super_administrator':
            if not body.current_password or not verify_password(body.current_password, target.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mevcut şifre hatalı",
                )

    if len(body.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Şifre en az 6 karakter olmalıdır")

    target.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"status": "ok"}


@router.put("/users/{user_id}/role", status_code=status.HTTP_200_OK)
async def update_role(
    user_id: int,
    body: UserUpdateRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz rol")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")

    if current_user.id == user_id and body.role != 'super_administrator':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendi rolünüzü düşüremezsiniz",
        )

    if target.role == 'super_administrator' and body.role != 'super_administrator':
        count_result = await db.execute(
            select(User).where(User.role == 'super_administrator', User.is_active == True)
        )
        if len(count_result.scalars().all()) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Son super administrator'ın rolü değiştirilemez",
            )

    target.role = body.role
    target.is_admin = (body.role == 'super_administrator')
    await db.commit()
    return {"status": "ok"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(body: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    from app.services.email_service import send_password_reset_email
    from app.core.config import settings

    smtp_configured = bool(settings.SMTP_HOST and settings.SMTP_FROM)

    # Production'da SMTP yapılandırılmamışsa kullanıcıya net hata ver
    if not smtp_configured and settings.ENVIRONMENT != "development":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mail servisi yapılandırılmamış. Şifre sıfırlama için sistem yöneticisiyle iletişime geçin.",
        )

    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    if user and user.email:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        reset_token = PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at)
        db.add(reset_token)
        await db.commit()
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        await send_password_reset_email(user.email, reset_link, token)

    # Her durumda aynı yanıt — kullanıcı adı/e-posta varlığı sızdırılmaz
    return {"message": "Şifre sıfırlama talebi alındı. E-posta adresinizi kontrol edin."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(body: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == body.token)
    )
    reset_token = result.scalar_one_or_none()

    if not reset_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz token")

    now = datetime.now(timezone.utc)
    if reset_token.expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token süresi dolmuş")

    if reset_token.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token zaten kullanıldı")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Şifre en az 6 karakter olmalıdır")

    user_result = await db.execute(select(User).where(User.id == reset_token.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kullanıcı bulunamadı")

    user.hashed_password = hash_password(body.new_password)
    reset_token.used_at = now
    await db.commit()
    return {"message": "Şifre başarıyla güncellendi"}
