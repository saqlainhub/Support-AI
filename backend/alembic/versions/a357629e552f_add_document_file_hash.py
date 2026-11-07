"""add document file hash

Revision ID: a357629e552f
Revises: cefb88c5bdfa
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a357629e552f"
down_revision: Union[str, Sequence[str], None] = "cefb88c5bdfa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the column temporarily as nullable because
    # existing documents already exist in the database.
    op.add_column(
        "documents",
        sa.Column(
            "file_hash",
            sa.String(length=64),
            nullable=True
        )
    )

    # Give existing documents temporary unique values.
    connection = op.get_bind()

    connection.execute(
        sa.text(
            """
            UPDATE documents
            SET file_hash = 'legacy-' || id::text
            WHERE file_hash IS NULL
            """
        )
    )

    # Now every existing row has a value.
    op.alter_column(
        "documents",
        "file_hash",
        existing_type=sa.String(length=64),
        nullable=False
    )

    # Prevent duplicate hashes.
    op.create_unique_constraint(
        "uq_documents_file_hash",
        "documents",
        ["file_hash"]
    )

    # Speed up hash lookups.
    op.create_index(
        "ix_documents_file_hash",
        "documents",
        ["file_hash"],
        unique=False
    )


def downgrade() -> None:
    op.drop_index(
        "ix_documents_file_hash",
        table_name="documents"
    )

    op.drop_constraint(
        "uq_documents_file_hash",
        "documents",
        type_="unique"
    )

    op.drop_column(
        "documents",
        "file_hash"
    )