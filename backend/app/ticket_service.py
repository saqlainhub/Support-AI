
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SupportTicket


async def create_ticket(
    db: AsyncSession,
    customer_id: int,
    conversation_id: int,
    subject: str,
    description: str,
) -> SupportTicket:
    ticket = SupportTicket(
        customer_id=customer_id,
        conversation_id=conversation_id,
        subject=subject,
        description=description,
    )

    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    return ticket