from datetime import date, datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Category(db.Model):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("name", "type", name="uq_category_name_type"),
        CheckConstraint("type IN ('income', 'expense')", name="ck_category_type"),
        CheckConstraint("status IN ('enabled', 'disabled')", name="ck_category_status"),
        Index("ix_category_id_type", "id", "type", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="enabled")
    description: Mapped[str | None] = mapped_column(String(255))
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(50))
    display_order: Mapped[int | None] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="category", passive_deletes=False
    )


class Transaction(db.Model):
    __tablename__ = "transactions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["category_id", "type"],
            ["categories.id", "categories.type"],
            name="fk_transaction_category",
            ondelete="RESTRICT",
        ),
        CheckConstraint("type IN ('income', 'expense')", name="ck_transaction_type"),
        CheckConstraint("amount > 0", name="ck_transaction_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    category_id: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    date: Mapped[date] = mapped_column(db.Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )

    category: Mapped["Category"] = relationship(back_populates="transactions")
