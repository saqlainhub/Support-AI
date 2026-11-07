import asyncio

from app.database import SessionLocal
from app.document_loader import extract_pages_from_pdf
from app.ingestion_service import ingest_document


async def main():

    pages = extract_pages_from_pdf(
        r"D:\Work\Customer Support System\test.pdf"
    )

    async with SessionLocal() as db:

        document_id = await ingest_document(
            db=db,
            filename="test.pdf",
            pages=pages
        )

        print("Document ID:", document_id)


asyncio.run(main())