import asyncio

from sqlalchemy import text

from app.database import SessionLocal


async def main():

    async with SessionLocal() as db:

        print("Testing database connection...")

        result = await db.execute(
            text("SELECT 1")
        )

        print("Database connection works.")
        print("Result:", result.scalar())


if __name__ == "__main__":
    asyncio.run(main())