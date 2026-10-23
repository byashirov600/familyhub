from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, Token, TokenData, UserUpdate
from app.config import settings
from fastapi import UploadFile, File
import os
import shutil
from pathlib import Path
from sqlalchemy import update
from datetime import datetime

router = APIRouter(prefix="/users", tags=["users"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


from fastapi import UploadFile, File
import os
import shutil
from pathlib import Path

# Папки для аватаров и обложек
AVATARS_DIR = Path("uploads/avatars")
COVERS_DIR = Path("uploads/covers")
AVATARS_DIR.mkdir(parents=True, exist_ok=True)
COVERS_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
        avatar: UploadFile = File(...),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Загрузить аватарку"""

    # Удаляем старый аватар если есть
    if current_user.avatar_path and os.path.exists(current_user.avatar_path):
        os.remove(current_user.avatar_path)

    # Сохраняем новый
    file_extension = os.path.splitext(avatar.filename)[1]
    filename = f"avatar_{current_user.id}{file_extension}"
    avatar_path = str(AVATARS_DIR / filename)

    with open(avatar_path, "wb") as buffer:
        shutil.copyfileobj(avatar.file, buffer)

    # Обновляем в БД
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(avatar_path=avatar_path)
    )
    await db.commit()

    # Возвращаем обновлённого пользователя
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar_path": user.avatar_path,
        "cover_path": user.cover_path,
        "bio": user.bio,
        "created_at": user.created_at
    }


@router.post("/cover", response_model=UserResponse)
async def upload_cover(
        cover: UploadFile = File(...),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Загрузить обложку профиля"""

    # Удаляем старую обложку если есть
    if current_user.cover_path and os.path.exists(current_user.cover_path):
        os.remove(current_user.cover_path)

    # Сохраняем новую
    file_extension = os.path.splitext(cover.filename)[1]
    filename = f"cover_{current_user.id}{file_extension}"
    cover_path = str(COVERS_DIR / filename)

    with open(cover_path, "wb") as buffer:
        shutil.copyfileobj(cover.file, buffer)

    # Обновляем в БД
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(cover_path=cover_path)
    )
    await db.commit()

    # Возвращаем обновлённого пользователя
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar_path": user.avatar_path,
        "cover_path": user.cover_path,
        "bio": user.bio,
        "created_at": user.created_at
    }


@router.put("/profile", response_model=UserResponse)
async def update_profile(
        data: UserUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Обновить профиль"""

    update_data = {}
    if data.bio is not None:
        update_data['bio'] = data.bio
    if data.full_name is not None:
        update_data['full_name'] = data.full_name
    if data.birth_year is not None:
        update_data['birth_year'] = data.birth_year
    if data.workplace is not None:
        update_data['workplace'] = data.workplace

    if update_data:
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(**update_data)
        )
        await db.commit()

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar_path": user.avatar_path,
        "cover_path": user.cover_path,
        "bio": user.bio,
        "full_name": user.full_name,
        "birth_year": user.birth_year,
        "workplace": user.workplace,
        "is_online": user.is_online,
        "last_seen": user.last_seen,
        "created_at": user.created_at
    }


@router.post("/status/online")
async def set_online(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Установить статус онлайн"""

    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(is_online=True, last_seen=datetime.utcnow())
    )
    await db.commit()

    return {"status": "online"}


@router.post("/status/offline")
async def set_offline(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Установить статус оффлайн"""

    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(is_online=False, last_seen=datetime.utcnow())
    )
    await db.commit()

    return {"status": "offline"}


@router.get("/status/{user_id}")
async def get_user_status(
        user_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить статус пользователя"""

    result = await db.execute(
        select(User.id, User.is_online, User.last_seen).where(User.id == user_id)
    )
    user = result.first()

    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    return {
        "user_id": user.id,
        "is_online": user.is_online,
        "last_seen": user.last_seen.isoformat() if user.last_seen else None
    }


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    """Получить информацию о пользователе по ID"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user