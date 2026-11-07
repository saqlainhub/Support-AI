import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.engine import make_url


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

url = make_url(DATABASE_URL)

# Remove PostgreSQL libpq-specific query parameters
# that asyncpg does not understand.
url = url.difference_update_query(
    ["sslmode", "channel_binding"]
)

engine = create_async_engine(
    url,
    echo=True,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "ssl": "require"
    }
)

SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def get_db():
    async with SessionLocal() as session:
        yield session