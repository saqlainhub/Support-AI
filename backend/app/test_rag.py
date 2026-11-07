import asyncio

from app.database import SessionLocal
from app.rag_service import generate_rag_response


async def main():

    questions = [
        "How long do I have to request a refund?",
        "What do I need to provide for a refund?",
        "What is the capital of France?"
    ]

    async with SessionLocal() as db:

        for question in questions:

            print("\n" + "=" * 60)
            print("QUESTION:")
            print(question)

            response, interaction_id = await generate_rag_response(
                db=db,
                question=question
            )

            print("\nANSWER:")
            print(response.answer)

            print("\nSOURCES:")

            for source in response.sources:
                print(
                    f"- {source.document}, "
                    f"Page {source.page}"
                )


if __name__ == "__main__":
    asyncio.run(main())