from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pathlib import Path
from app.database import engine, Base
from app.routers import auth, users, posts, comments, likes

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = FastAPI(title="FamilyHub API", version="2.0.0")

@app.on_event("startup")
async def startup():
    await init_db()

# Роутеры API с префиксом /api
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(posts.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(likes.router, prefix="/api")

# Фронтенд на корне
@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    frontend_path = Path(__file__).parent.parent / "frontend" / "index.html"
    return frontend_path.read_text(encoding="utf-8")

# Отладка: печатаем роуты ПОСЛЕ добавления всех роутеров
@app.on_event("startup")
async def print_routes():
    for route in app.routes:
        if hasattr(route, 'path'):
            print(f"ROUTE: {route.path} -> {route.name}")