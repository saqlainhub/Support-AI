from sqlalchemy.ext.asyncio import AsyncSession

from app.chunker import chunk_pages
from app.embedding_service import create_embedding
from app.models import Document, DocumentChunk


async def ingest_document(
    db: AsyncSession,
    filename: str,
    file_hash: str,
    pages: list[tuple[int, str]]
):
    document = Document(
        filename=filename,
        file_hash=file_hash
    )

    db.add(document)

    await db.flush()

    chunks = chunk_pages(pages)

    for page_number, chunk in chunks:
        embedding = create_embedding(chunk)

        document_chunk = DocumentChunk(
            document_id=document.id,
            content=chunk,
            page_number=page_number,
            embedding=embedding
        )

        db.add(document_chunk)

    await db.commit()

    return document.id