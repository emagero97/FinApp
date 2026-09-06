from datetime import date

from sqlalchemy import String, cast, func, or_

from ..extensions import db
from ..models import Category, Transaction
from ..schemas.transaction import SORTABLE_FIELDS, TRANSACTION_TYPES
from .errors import ServiceError


def _parse_date(value) -> date | None:
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def list_transactions(args) -> list[tuple[Transaction, str]]:
    transaction_type = args.get("type")
    category_id = args.get("category_id")
    date_from = args.get("date_from")
    date_to = args.get("date_to")
    search = args.get("search", "").strip()
    sort_by = args.get("sort_by", "date")
    sort_dir = args.get("sort_dir", "desc")

    if transaction_type not in (None, *TRANSACTION_TYPES):
        raise ServiceError(400, {"errors": {"type": "Invalid type filter"}})
    if category_id is not None:
        try:
            category_id = int(category_id)
        except ValueError:
            raise ServiceError(400, {"errors": {"category_id": "Invalid category filter"}})
    if sort_by not in SORTABLE_FIELDS:
        sort_by = "date"
    if sort_dir not in ("asc", "desc"):
        sort_dir = "desc"

    query = db.session.query(Transaction, Category.name.label("category_name")).join(
        Category, Category.id == Transaction.category_id
    )

    if transaction_type:
        query = query.filter(Transaction.type == transaction_type)
    if category_id is not None:
        query = query.filter(Transaction.category_id == category_id)
    if date_from:
        parsed_from = _parse_date(date_from)
        if parsed_from is None:
            raise ServiceError(400, {"errors": {"date_from": "Invalid date"}})
        query = query.filter(Transaction.date >= parsed_from)
    if date_to:
        parsed_to = _parse_date(date_to)
        if parsed_to is None:
            raise ServiceError(400, {"errors": {"date_to": "Invalid date"}})
        query = query.filter(Transaction.date <= parsed_to)
    if search:
        like = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(func.coalesce(Transaction.notes, "")).like(like),
                cast(Transaction.amount, String).like(like),
                func.lower(Category.name).like(like),
            )
        )

    sort_column = {
        "date": Transaction.date,
        "amount": Transaction.amount,
        "created_at": Transaction.created_at,
        "category_name": Category.name,
    }[sort_by]
    if sort_dir == "desc":
        sort_column = sort_column.desc()
    query = query.order_by(sort_column, Transaction.id.desc())

    return query.all()


def get_transaction(transaction_id: int) -> Transaction:
    transaction = db.session.get(Transaction, transaction_id)
    if transaction is None:
        raise ServiceError(404, {"error": "Transaction not found"})
    return transaction


def validate_category(transaction_type: str, category_id: int, require_active: bool = False) -> Category:
    category = db.session.get(Category, category_id)
    if category is None:
        raise ServiceError(400, {"errors": {"category_id": "Category does not exist"}})
    if category.type != transaction_type:
        raise ServiceError(
            400,
            {
                "errors": {
                    "category_id": (
                        f"Category '{category.name}' is a {category.type} category and "
                        f"cannot be used for a {transaction_type} transaction"
                    )
                }
            },
        )
    if require_active and category.status == "disabled":
        raise ServiceError(
            400,
            {"errors": {"category_id": f"Category '{category.name}' is disabled"}},
        )
    return category


def create_transaction(fields: dict) -> Transaction:
    validate_category(fields["type"], fields["category_id"], require_active=True)
    transaction = Transaction(**fields)
    db.session.add(transaction)
    db.session.commit()
    return transaction


def update_transaction(transaction: Transaction, fields: dict) -> Transaction:
    category_id = fields.get("category_id", transaction.category_id)
    transaction_type = fields.get("type", transaction.type)
    validate_category(transaction_type, category_id)

    for key, value in fields.items():
        setattr(transaction, key, value)
    db.session.commit()
    return transaction


def delete_transaction(transaction: Transaction) -> None:
    db.session.delete(transaction)
    db.session.commit()