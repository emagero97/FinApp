CATEGORY_TYPES = ("income", "expense")
CATEGORY_STATUSES = ("enabled", "disabled")
SORTABLE_FIELDS = ("name", "type", "status", "display_order", "created_at", "transaction_count")


def serialize_category(category, stats: dict | None = None) -> dict:
    if stats is None:
        stats = {}
    return {
        "id": category.id,
        "name": category.name,
        "type": category.type,
        "status": category.status,
        "parent_id": category.parent_id,
        "parent_name": category.parent.name if category.parent else None,
        "child_count": len(category.children),
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


def parse_category_payload(data: dict, current=None) -> tuple[dict, dict]:
    """Validate a category payload. Returns (fields, errors).

    Only syntactic validation is done here; rules that need the database
    (parent existence/type match, duplicates, ...) live in the category service.
    """
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
    elif current is None:
        errors["name"] = "Name is required"

    if "type" in data or current is None:
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

    if "parent_id" in data or current is None:
        parent_id = data.get("parent_id")
        if parent_id is None:
            fields["parent_id"] = None
        elif isinstance(parent_id, bool) or not isinstance(parent_id, int):
            errors["parent_id"] = "parent_id must be an integer or null"
        elif current is not None and parent_id == current.id:
            errors["parent_id"] = "A category cannot be its own parent"
        else:
            fields["parent_id"] = parent_id

    return fields, errors