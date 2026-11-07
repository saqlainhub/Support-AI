
import asyncio
import getpass

from sqlalchemy import func, select

from app.auth import hash_password
from app.database import SessionLocal
from app.models import AdminUser


async def main() -> None:
    async with SessionLocal() as db:
        result = await db.execute(select(func.count()).select_from(AdminUser))
        admin_count = result.scalar_one()

        if admin_count > 0:
            print(
                "An admin account already exists. "
                "Initial setup is not allowed."
            )
            return

        username = input("Initial admin username: ").strip()
        if len(username) < 3 or len(username) > 100:
            print("Username must contain 3–100 characters.")
            return

        result = await db.execute(
            select(AdminUser).where(
                func.lower(AdminUser.username) == username.lower()
            )
        )
        if result.scalar_one_or_none() is not None:
            print("That username already exists.")
            return

        password = getpass.getpass("Initial admin password: ")
        confirmation = getpass.getpass("Confirm password: ")

        if password != confirmation:
            print("Passwords do not match.")
            return

        if len(password) < 12 or len(password) > 128:
            print("Password must contain 12–128 characters.")
            return

        if len(password.encode("utf-8")) > 1024:
            print("Password is too long.")
            return

        admin = AdminUser(
            username=username,
            password_hash=hash_password(password),
            is_active=True,
        )

        db.add(admin)

        try:
            await db.commit()
        except Exception:
            await db.rollback()
            raise

        print(f"Initial admin created successfully: {username}")


if __name__ == "__main__":
    asyncio.run(main())
