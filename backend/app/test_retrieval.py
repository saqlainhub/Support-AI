import asyncio

from app.database import SessionLocal
from app.retrieval_service import search_similar_chunks


async def main():

    questions = [
        "How long do I have to request a refund?",
        "What do I need to provide for a refund?",
        "What is the company's return policy?",
        "What is the capital of France?",
        "How do I reset my WiFi router?"
    ]

    async with SessionLocal() as db:

        for question in questions:

            print("\n" + "=" * 60)
            print("QUESTION:")
            print(question)

            results = await search_similar_chunks(
                db=db,
                query=question,
                limit=5
            )

            print("\nRETRIEVED CHUNKS:")

            if not results:
                print("No relevant chunks found.")
                continue

            for index, (chunk, filename, distance) in enumerate(
                results,
                start=1
            ):
                print(f"\n--- Result {index} ---")
                print(f"Document: {filename}")
                print(f"Page: {chunk.page_number}")
                print(f"Distance: {distance:.4f}")
                print(f"Content:\n{chunk.content}")


if __name__ == "__main__":
    asyncio.run(main())