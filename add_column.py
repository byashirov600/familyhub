import asyncio
from sqlalchemy import text
from app.database import engine

async def add_column():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS attachment_path TEXT
        """))
        await conn.execute(text("""
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        """))
        print("✅ Столбцы добавлены!")

if __name__ == "__main__":
    asyncio.run(add_column())