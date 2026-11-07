
import asyncio

from sqlalchemy import text

from app.database import SessionLocal
from app.embedding_service import create_embedding


async def main():
    print("1. Creating query embedding...")

    embedding = create_embedding(
        "How long do I have to request a refund?"
    )

    print("Embedding dimensions:", len(embedding))

    async with SessionLocal() as db:
        print("2. Testing vector comparison...")

        result = await db.execute(
            text("""
                SELECT
                    id,
                    embedding <=> CAST(:embedding AS vector) AS distance
                FROM document_chunks
                ORDER BY embedding <=> CAST(:embedding AS vector)
                LIMIT 5
            """),
            {"embedding": str(embedding)}
        )

        rows = result.all()

        print("3. Query completed.")
        for row in rows:
            print(row)


if __name__ == "__main__":
    asyncio.run(main())