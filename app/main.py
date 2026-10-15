from fastapi import FastAPI
from app.database import engine, Base
from app.routers import auth, users, posts, comments, likes
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like

# Создаем таблицы при запуске
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = FastAPI(title="FamilyHub API", version="2.0.0")

@app.on_event("startup")
async def startup():
    await init_db()

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(posts.router)
app.include_router(comments.router)
app.include_router(likes.router)

@app.get("/")
async def root():
    return {"message": "Welcome to FamilyHub!"}