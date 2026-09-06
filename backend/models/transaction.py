from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import utcnow


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