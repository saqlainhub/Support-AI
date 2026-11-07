import asyncio

from sqlalchemy import select

from app.database import SessionLocal
from app.models import DocumentChunk


async def main():

    async with SessionLocal() as db:

        result = await db.execute(
            select(DocumentChunk).order_by(DocumentChunk.id)
        )

        chunks = result.scalars().all()

        print(f"Total chunks: {len(chunks)}")

        for chunk in chunks:
            print("\n" + "=" * 60)
            print(f"ID: {chunk.id}")
            print(f"Document ID: {chunk.document_id}")
            print(f"Page: {chunk.page_number}")
            print(chunk.content)


if __name__ == "__main__":
    asyncio.run(main())