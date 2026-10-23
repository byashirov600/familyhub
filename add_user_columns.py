import asyncio
from sqlalchemy import text
from app.database import engine

async def add_columns():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS avatar_path TEXT
        """))
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS cover_path TEXT
        """))
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS bio TEXT
        """))
        print("✅ Столбцы добавлены!")

if __name__ == "__main__":
    asyncio.run(add_columns())