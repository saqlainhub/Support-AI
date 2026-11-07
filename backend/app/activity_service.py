
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SystemActivity


async def log_activity(
    db: AsyncSession,
    event_type: str,
    description: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> SystemActivity:
    activity = SystemActivity(
        event_type=event_type,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
    )

    db.add(activity)
    await db.flush()

    return activity