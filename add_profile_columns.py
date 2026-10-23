import asyncio
from sqlalchemy import text
from app.database import engine

async def add_columns():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS full_name TEXT
        """))
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS birth_year INTEGER
        """))
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS workplace TEXT
        """))
        print("✅ Столбцы добавлены!")

if __name__ == "__main__":
    asyncio.run(add_columns())