from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentResponse
from app.routers.users import get_current_user

router = APIRouter(prefix="/comments", tags=["comments"])


@router.post("/", response_model=CommentResponse, status_code=201)
async def create_comment(
        comment: CommentCreate,
        post_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Добавить комментарий к посту"""

    # Проверка есть ли пост
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Создаём комментарий
    new_comment = Comment(
        text=comment.text,
        post_id=post_id,
        author_id=current_user.id
    )

    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)

    return new_comment


@router.get("/post/{post_id}", response_model=list[CommentResponse])
async def get_post_comments(
        post_id: int,
        db: AsyncSession = Depends(get_db)
):
    """Получить все комментарии к посту"""
    result = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.desc())
    )
    comments = result.scalars().all()
    return comments


@router.delete("/{comment_id}", status_code=204)
async def delete_comment(
        comment_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Удалить комментарий (только автор может)"""
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    await db.delete(comment)
    await db.commit()

    return None