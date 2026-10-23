import asyncio
from sqlalchemy import text
from app.database import engine

async def add_columns():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE
        """))
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        """))
        print("✅ Столбцы добавлены!")

if __name__ == "__main__":
    asyncio.run(add_columns())