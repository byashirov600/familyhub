from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import os
import shutil
from app.database import get_db
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostResponse
from app.routers.users import get_current_user

router = APIRouter(prefix="/posts", tags=["posts"])
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/", response_model=PostResponse, status_code=201)
async def create_post(
        title: str = Form(...),
        content: str = Form(...),
        image: Optional[UploadFile] = File(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    image_path = None

    if image:
        file_extension = os.path.splitext(image.filename)[1]
        result = await db.execute(select(func.count(Post.id)))
        posts_count = result.scalar()
        filename = f"post_{current_user.id}_{posts_count + 1}{file_extension}"
        image_path = os.path.join(UPLOAD_DIR, filename)

        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

    new_post = Post(
        title=title,
        content=content,
        image_path=image_path,
        author_id=current_user.id
    )

    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)

    return new_post


@router.get("/", response_model=list[PostResponse])
async def get_posts(skip: int = 0, limit: int = 10, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Post).order_by(Post.created_at.desc()).offset(skip).limit(limit)
    )
    posts = result.scalars().all()

    # Добавляем username автора
    response = []
    for post in posts:
        author_result = await db.execute(select(User).where(User.id == post.author_id))
        author = author_result.scalar_one_or_none()

        post_dict = {
            "id": post.id,
            "title": post.title,
            "content": post.content,
            "image_path": post.image_path,
            "created_at": post.created_at,
            "author_id": post.author_id,
            "author_username": author.username if author else "Unknown"
        }
        response.append(post_dict)

    return response

@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
        post_id: int,
        title: str = Form(...),
        content: str = Form(...),
        image: Optional[UploadFile] = File(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    post.title = title
    post.content = content

    if image:
        if post.image_path and os.path.exists(post.image_path):
            os.remove(post.image_path)

        file_extension = os.path.splitext(image.filename)[1]
        filename = f"post_{current_user.id}_{post_id}{file_extension}"
        post.image_path = os.path.join(UPLOAD_DIR, filename)

        with open(post.image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=204)
async def delete_post(
        post_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if post.image_path and os.path.exists(post.image_path):
        os.remove(post.image_path)

    await db.delete(post)
    await db.commit()
    return None