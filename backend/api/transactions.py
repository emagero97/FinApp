from datetime import date, datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_

from ..extensions import db
from ..models import Category, Transaction

bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")

TRANSACTION_TYPES = ("income", "expense")
SORTABLE_FIELDS = ("date", "amount", "created_at", "category_name")


def _serialize(transaction: Transaction, category_name: str | None = None) -> dict:
    return {
        "id": transaction.id,
        "type": transaction.type,
        "category_id": transaction.category_id,
        "category_name": category_name or (transaction.category.name if transaction.category else None),
        "amount": str(transaction.amount),
        "date": transaction.date.isoformat() if transaction.date else None,
        "notes": transaction.notes,
        "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
        "updated_at": transaction.updated_at.isoformat() if transaction.updated_at else None,
    }


def _parse_payload() -> dict:
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object")
    return data


def _parse_date(value) -> date | None:
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def _validate_common(data: dict, transaction: Transaction | None = None) -> tuple[dict, dict]:
    errors: dict[str, str] = {}
    fields: dict = {}

    if "type" in data or transaction is None:
        transaction_type = data.get("type")
        if transaction_type not in TRANSACTION_TYPES:
            errors["type"] = "Type must be 'income' or 'expense'"
        else:
            fields["type"] = transaction_type

    if "category_id" in data or transaction is None:
        category_id = data.get("category_id")
        if not isinstance(category_id, int):
            errors["category_id"] = "A valid category is required"
        else:
            fields["category_id"] = category_id

    if "amount" in data or transaction is None:
        amount = data.get("amount")
        if isinstance(amount, str):
            try:
                amount = float(amount)
            except ValueError:
                amount = None
        if not isinstance(amount, (int, float)) or isinstance(amount, bool) or amount <= 0:
            errors["amount"] = "Amount must be a positive number"
        else:
            fields["amount"] = round(amount, 2)

    if "date" in data or transaction is None:
        parsed = _parse_date(data.get("date"))
        if parsed is None:
            errors["date"] = "Date must use the format YYYY-MM-DD"
        else:
            fields["date"] = parsed

    if "notes" in data:
        value = data["notes"]
        if value is not None and not isinstance(value, str):
            errors["notes"] = "Notes must be a string"
        else:
            fields["notes"] = value

    return fields, errors


def _get_category(category_id: int) -> Category | None:
    return db.session.get(Category, category_id)


@bp.get("")
def list_transactions():
    transaction_type = request.args.get("type")
    category_id = request.args.get("category_id")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    search = request.args.get("search", "").strip()
    sort_by = request.args.get("sort_by", "date")
    sort_dir = request.args.get("sort_dir", "desc")

    if transaction_type not in (None, *TRANSACTION_TYPES):
        return jsonify({"errors": {"type": "Invalid type filter"}}), 400
    if category_id is not None:
        try:
            category_id = int(category_id)
        except ValueError:
            return jsonify({"errors": {"category_id": "Invalid category filter"}}), 400
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
            return jsonify({"errors": {"date_from": "Invalid date"}}), 400
        query = query.filter(Transaction.date >= parsed_from)
    if date_to:
        parsed_to = _parse_date(date_to)
        if parsed_to is None:
            return jsonify({"errors": {"date_to": "Invalid date"}}), 400
        query = query.filter(Transaction.date <= parsed_to)
    if search:
        like = f"%{search.lower()}%"
        query = query.filter(func.lower(Transaction.notes).like(like))

    sort_column = {
        "date": Transaction.date,
        "amount": Transaction.amount,
        "created_at": Transaction.created_at,
        "category_name": Category.name,
    }[sort_by]
    if sort_dir == "desc":
        sort_column = sort_column.desc()
    query = query.order_by(sort_column, Transaction.id.desc())

    rows = query.all()
    return jsonify(
        {
            "transactions": [_serialize(tx, cat) for tx, cat in rows],
            "total": len(rows),
        }
    )


@bp.get("/<int:transaction_id>")
def get_transaction(transaction_id: int):
    transaction = db.session.get(Transaction, transaction_id)
    if transaction is None:
        return jsonify({"error": "Transaction not found"}), 404
    return jsonify(_serialize(transaction))


@bp.post("")
def create_transaction():
    try:
        data = _parse_payload()
    except ValueError as exc:
        return jsonify({"errors": {"body": str(exc)}}), 400

    fields, errors = _validate_common(data)
    if errors:
        return jsonify({"errors": errors}), 400

    category = _get_category(fields["category_id"])
    if category is None:
        return jsonify({"errors": {"category_id": "Category does not exist"}}), 400
    if category.type != fields["type"]:
        return (
            jsonify(
                {
                    "errors": {
                        "category_id": (
                            f"Category '{category.name}' is a {category.type} category and "
                            f"cannot be used for a {fields['type']} transaction"
                        )
                    }
                }
            ),
            400,
        )
    if category.status == "disabled":
        return (
            jsonify(
                {"errors": {"category_id": f"Category '{category.name}' is disabled"}}
            ),
            400,
        )

    transaction = Transaction(**fields)
    db.session.add(transaction)
    db.session.commit()
    return jsonify(_serialize(transaction)), 201


@bp.put("/<int:transaction_id>")
def update_transaction(transaction_id: int):
    transaction = db.session.get(Transaction, transaction_id)
    if transaction is None:
        return jsonify({"error": "Transaction not found"}), 404

    try:
        data = _parse_payload()
    except ValueError as exc:
        return jsonify({"errors": {"body": str(exc)}}), 400

    fields, errors = _validate_common(data, transaction=transaction)
    if errors:
        return jsonify({"errors": errors}), 400

    category_id = fields.get("category_id", transaction.category_id)
    transaction_type = fields.get("type", transaction.type)
    category = _get_category(category_id)
    if category is None:
        return jsonify({"errors": {"category_id": "Category does not exist"}}), 400
    if category.type != transaction_type:
        return (
            jsonify(
                {
                    "errors": {
                        "category_id": (
                            f"Category '{category.name}' is a {category.type} category and "
                            f"cannot be used for a {transaction_type} transaction"
                        )
                    }
                }
            ),
            400,
        )

    for key, value in fields.items():
        setattr(transaction, key, value)
    db.session.commit()
    return jsonify(_serialize(transaction))


@bp.delete("/<int:transaction_id>")
def delete_transaction(transaction_id: int):
    transaction = db.session.get(Transaction, transaction_id)
    if transaction is None:
        return jsonify({"error": "Transaction not found"}), 404
    db.session.delete(transaction)
    db.session.commit()
    return "", 204
