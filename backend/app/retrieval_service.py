from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.embedding_service import create_embedding
from app.models import Document, DocumentChunk




async def search_similar_chunks(
    db: AsyncSession,
    query: str,
    limit: int = 5,
    max_distance: float = 0.5
):
    query_embedding = create_embedding(query)

    distance = DocumentChunk.embedding.cosine_distance(
        query_embedding
    )

    result = await db.execute(
        select(
            DocumentChunk,
            Document.filename,
            distance.label("distance")
        )
        .join(
            Document,
            Document.id == DocumentChunk.document_id
        )
        .where(
            distance <= max_distance
        )
        .order_by(distance)
        .limit(limit)
    )

    results = result.all()

    return [
        (chunk, filename, distance_value)
        for chunk, filename, distance_value in results
    ]