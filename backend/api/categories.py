from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_

from ..extensions import db
from ..models import Category, Transaction

bp = Blueprint("categories", __name__, url_prefix="/api/categories")

CATEGORY_TYPES = ("income", "expense")
CATEGORY_STATUSES = ("enabled", "disabled")
SORTABLE_FIELDS = ("name", "type", "status", "display_order", "created_at", "transaction_count")


def _serialize(category: Category, stats: dict | None = None) -> dict:
    if stats is None:
        stats = _stats_for([category.id]).get(category.id, {})
    return {
        "id": category.id,
        "name": category.name,
        "type": category.type,
        "status": category.status,
        "description": category.description,
        "icon": category.icon,
        "color": category.color,
        "display_order": category.display_order,
        "transaction_count": stats.get("transaction_count", 0),
        "total_amount": str(stats.get("total_amount", 0)),
        "last_transaction_date": stats.get("last_transaction_date"),
        "created_at": category.created_at.isoformat() if category.created_at else None,
        "updated_at": category.updated_at.isoformat() if category.updated_at else None,
    }


def _stats_for(category_ids: list[int]) -> dict[int, dict]:
    if not category_ids:
        return {}
    rows = (
        db.session.query(
            Transaction.category_id,
            func.count(Transaction.id).label("transaction_count"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total_amount"),
            func.max(Transaction.date).label("last_transaction_date"),
        )
        .filter(Transaction.category_id.in_(category_ids))
        .group_by(Transaction.category_id)
        .all()
    )
    return {
        row.category_id: {
            "transaction_count": row.transaction_count,
            "total_amount": row.total_amount,
            "last_transaction_date": (
                row.last_transaction_date.isoformat() if row.last_transaction_date else None
            ),
        }
        for row in rows
    }


def _parse_payload() -> dict:
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object")
    return data


def _validate_common(data: dict, category: Category | None = None) -> tuple[dict, dict]:
    errors: dict[str, str] = {}
    fields: dict = {}

    name = data.get("name")
    if name is not None:
        if not isinstance(name, str):
            errors["name"] = "Name must be a string"
        else:
            stripped = name.strip()
            if not stripped:
                errors["name"] = "Name is required and cannot be blank"
            else:
                fields["name"] = stripped
    elif category is None:
        errors["name"] = "Name is required"

    if "type" in data or category is None:
        category_type = data.get("type")
        if category_type not in CATEGORY_TYPES:
            errors["type"] = "Type must be 'income' or 'expense'"
        else:
            fields["type"] = category_type

    if "status" in data:
        status = data.get("status")
        if status not in CATEGORY_STATUSES:
            errors["status"] = "Status must be 'enabled' or 'disabled'"
        else:
            fields["status"] = status

    for field in ("description", "icon", "color"):
        if field in data:
            value = data[field]
            if value is not None and not isinstance(value, str):
                errors[field] = f"{field} must be a string"
            else:
                fields[field] = value

    if "display_order" in data:
        value = data["display_order"]
        if value is not None and not isinstance(value, int):
            errors["display_order"] = "display_order must be an integer"
        else:
            fields["display_order"] = value

    return fields, errors


def _find_duplicate(name: str, category_type: str, exclude_id: int | None = None) -> Category | None:
    query = Category.query.filter(
        func.lower(Category.name) == name.lower(), Category.type == category_type
    )
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)
    return query.first()


@bp.get("")
def list_categories():
    search = request.args.get("search", "").strip()
    category_type = request.args.get("type")
    status = request.args.get("status")
    sort_by = request.args.get("sort_by", "name")
    sort_dir = request.args.get("sort_dir", "asc")

    if category_type not in (None, *CATEGORY_TYPES):
        return jsonify({"errors": {"type": "Invalid type filter"}}), 400
    if status not in (None, *CATEGORY_STATUSES):
        return jsonify({"errors": {"status": "Invalid status filter"}}), 400
    if sort_by not in SORTABLE_FIELDS:
        sort_by = "name"
    if sort_dir not in ("asc", "desc"):
        sort_dir = "asc"

    stats_sub = (
        db.session.query(
            Transaction.category_id,
            func.count(Transaction.id).label("transaction_count"),
        )
        .group_by(Transaction.category_id)
        .subquery()
    )

    query = db.session.query(Category).outerjoin(
        stats_sub, stats_sub.c.category_id == Category.id
    )

    if search:
        like = f"%{search.lower()}%"
        query = query.filter(func.lower(Category.name).like(like))
    if category_type:
        query = query.filter(Category.type == category_type)
    if status:
        query = query.filter(Category.status == status)

    sort_column = {
        "name": Category.name,
        "type": Category.type,
        "status": Category.status,
        "display_order": Category.display_order,
        "created_at": Category.created_at,
        "transaction_count": stats_sub.c.transaction_count,
    }[sort_by]
    if sort_dir == "desc":
        sort_column = sort_column.desc()
    query = query.order_by(sort_column, Category.name)

    categories = query.all()
    stats = _stats_for([c.id for c in categories])
    return jsonify(
        {"categories": [_serialize(c, stats.get(c.id)) for c in categories], "total": len(categories)}
    )


@bp.get("/<int:category_id>")
def get_category(category_id: int):
    category = db.session.get(Category, category_id)
    if category is None:
        return jsonify({"error": "Category not found"}), 404
    return jsonify(_serialize(category))


@bp.post("")
def create_category():
    try:
        data = _parse_payload()
    except ValueError as exc:
        return jsonify({"errors": {"body": str(exc)}}), 400

    fields, errors = _validate_common(data)
    if errors:
        return jsonify({"errors": errors}), 400

    duplicate = _find_duplicate(fields["name"], fields["type"])
    if duplicate is not None:
        return (
            jsonify(
                {"errors": {"name": f"A {fields['type']} category named '{fields['name']}' already exists"}}
            ),
            409,
        )

    category = Category(**fields)
    db.session.add(category)
    db.session.commit()
    return jsonify(_serialize(category)), 201


@bp.put("/<int:category_id>")
def update_category(category_id: int):
    category = db.session.get(Category, category_id)
    if category is None:
        return jsonify({"error": "Category not found"}), 404

    try:
        data = _parse_payload()
    except ValueError as exc:
        return jsonify({"errors": {"body": str(exc)}}), 400

    fields, errors = _validate_common(data, category=category)
    if errors:
        return jsonify({"errors": errors}), 400

    transaction_count = (
        db.session.query(func.count(Transaction.id))
        .filter(Transaction.category_id == category.id)
        .scalar()
    )

    new_type = fields.get("type", category.type)
    if new_type != category.type and transaction_count > 0:
        return (
            jsonify(
                {
                    "errors": {
                        "type": (
                            "This category cannot change type because it is linked to "
                            f"{transaction_count} transactions"
                        )
                    }
                }
            ),
            409,
        )

    if "name" in fields or "type" in fields:
        name = fields.get("name", category.name)
        category_type = fields.get("type", category.type)
        duplicate = _find_duplicate(name, category_type, exclude_id=category.id)
        if duplicate is not None:
            return (
                jsonify(
                    {"errors": {"name": f"A {category_type} category named '{name}' already exists"}}
                ),
                409,
            )

    for key, value in fields.items():
        setattr(category, key, value)
    db.session.commit()
    return jsonify(_serialize(category))


@bp.delete("/<int:category_id>")
def delete_category(category_id: int):
    category = db.session.get(Category, category_id)
    if category is None:
        return jsonify({"error": "Category not found"}), 404

    transaction_count = (
        db.session.query(func.count(Transaction.id))
        .filter(Transaction.category_id == category.id)
        .scalar()
    )
    if transaction_count > 0:
        return (
            jsonify(
                {
                    "error": (
                        "This category cannot be deleted because it is associated with "
                        f"{transaction_count} transactions. You can disable it to prevent it "
                        "from being used for new transactions."
                    )
                }
            ),
            409,
        )

    db.session.delete(category)
    db.session.commit()
    return "", 204
