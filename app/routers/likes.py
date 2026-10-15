from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models.like import Like
from app.models.post import Post
from app.models.user import User
from app.schemas.like import LikeResponse
from app.routers.users import get_current_user

router = APIRouter(prefix="/likes", tags=["likes"])


@router.post("/post/{post_id}", response_model=LikeResponse, status_code=201)
async def like_post(
        post_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Поставить лайк на пост"""

    # Проверяем, существует ли пост
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Проверяем, не лайкнул ли уже
    result = await db.execute(
        select(Like).where(
            Like.post_id == post_id,
            Like.user_id == current_user.id
        )
    )
    existing_like = result.scalar_one_or_none()

    if existing_like:
        raise HTTPException(status_code=400, detail="You already liked this post")

    # Создаём лайк
    new_like = Like(
        post_id=post_id,
        user_id=current_user.id
    )

    db.add(new_like)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="You already liked this post")

    await db.refresh(new_like)

    return new_like


@router.delete("/post/{post_id}", status_code=204)
async def unlike_post(
        post_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Убрать лайк с поста"""
    result = await db.execute(
        select(Like).where(
            Like.post_id == post_id,
            Like.user_id == current_user.id
        )
    )
    like = result.scalar_one_or_none()

    if not like:
        raise HTTPException(status_code=404, detail="Like not found")

    await db.delete(like)
    await db.commit()

    return None


@router.get("/post/{post_id}/count")
async def get_like_count(
        post_id: int,
        db: AsyncSession = Depends(get_db)
):
    """Получить количество лайков на посте"""
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(Like.id)).where(Like.post_id == post_id)
    )
    count = result.scalar()
    return {"post_id": post_id, "likes_count": count}