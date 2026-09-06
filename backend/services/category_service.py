from sqlalchemy import func

from ..extensions import db
from ..models import Category, Transaction
from ..schemas.category import CATEGORY_STATUSES, CATEGORY_TYPES, SORTABLE_FIELDS
from .errors import ServiceError


def stats_for(category_ids: list[int]) -> dict[int, dict]:
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


def get_category(category_id: int) -> Category:
    category = db.session.get(Category, category_id)
    if category is None:
        raise ServiceError(404, {"error": "Category not found"})
    return category


def list_categories(args) -> tuple[list[Category], dict[int, dict]]:
    search = args.get("search", "").strip()
    category_type = args.get("type")
    status = args.get("status")
    parent_id = args.get("parent_id")
    sort_by = args.get("sort_by", "name")
    sort_dir = args.get("sort_dir", "asc")

    if category_type not in (None, *CATEGORY_TYPES):
        raise ServiceError(400, {"errors": {"type": "Invalid type filter"}})
    if status not in (None, *CATEGORY_STATUSES):
        raise ServiceError(400, {"errors": {"status": "Invalid status filter"}})
    if parent_id is not None:
        try:
            parent_id = int(parent_id)
        except ValueError:
            raise ServiceError(400, {"errors": {"parent_id": "Invalid parent filter"}})
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
    if parent_id is not None:
        query = query.filter(Category.parent_id == parent_id)

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
    return categories, stats_for([c.id for c in categories])


def find_duplicate(
    name: str, category_type: str, parent_id: int | None, exclude_id: int | None = None
) -> Category | None:
    query = Category.query.filter(
        func.lower(Category.name) == name.lower(),
        Category.type == category_type,
        Category.parent_id == parent_id,
    )
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)
    return query.first()


def validate_parent(fields: dict, target_type: str) -> None:
    """Ensure the parent (if set) exists and has the same type as the child."""
    parent_id = fields.get("parent_id")
    if parent_id is None:
        return
    parent = db.session.get(Category, parent_id)
    if parent is None:
        raise ServiceError(400, {"errors": {"parent_id": "Parent category does not exist"}})
    if parent.type != target_type:
        raise ServiceError(
            400,
            {
                "errors": {
                    "parent_id": (
                        f"Parent category '{parent.name}' is a {parent.type} category and "
                        f"cannot have a {target_type} subcategory"
                    )
                }
            },
        )


def create_category(fields: dict) -> Category:
    validate_parent(fields, fields["type"])

    duplicate = find_duplicate(fields["name"], fields["type"], fields.get("parent_id"))
    if duplicate is not None:
        raise ServiceError(
            409,
            {
                "errors": {
                    "name": f"A {fields['type']} category named '{fields['name']}' already exists"
                }
            },
        )

    category = Category(**fields)
    db.session.add(category)
    db.session.commit()
    return category


def update_category(category: Category, fields: dict) -> Category:
    transaction_count = (
        db.session.query(func.count(Transaction.id))
        .filter(Transaction.category_id == category.id)
        .scalar()
    )
    child_count = (
        db.session.query(func.count(Category.id))
        .filter(Category.parent_id == category.id)
        .scalar()
    )

    new_type = fields.get("type", category.type)
    if new_type != category.type and (transaction_count > 0 or child_count > 0):
        reason = (
            f"it is linked to {transaction_count} transactions"
            if transaction_count > 0
            else f"it has {child_count} subcategories"
        )
        raise ServiceError(
            409,
            {
                "errors": {
                    "type": f"This category cannot change type because {reason}"
                }
            },
        )

    if "name" in fields or "type" in fields or "parent_id" in fields:
        name = fields.get("name", category.name)
        category_type = fields.get("type", category.type)
        parent_id = fields.get("parent_id", category.parent_id)
        duplicate = find_duplicate(name, category_type, parent_id, exclude_id=category.id)
        if duplicate is not None:
            raise ServiceError(
                409,
                {
                    "errors": {
                        "name": f"A {category_type} category named '{name}' already exists"
                    }
                },
            )

    validate_parent({**fields, "type": new_type}, new_type)

    for key, value in fields.items():
        setattr(category, key, value)
    db.session.commit()
    return category


def delete_category(category: Category) -> None:
    transaction_count = (
        db.session.query(func.count(Transaction.id))
        .filter(Transaction.category_id == category.id)
        .scalar()
    )
    if transaction_count > 0:
        raise ServiceError(
            409,
            {
                "error": (
                    "This category cannot be deleted because it is associated with "
                    f"{transaction_count} transactions. You can disable it to prevent it "
                    "from being used for new transactions."
                )
            },
        )

    child_count = (
        db.session.query(func.count(Category.id))
        .filter(Category.parent_id == category.id)
        .scalar()
    )
    if child_count > 0:
        raise ServiceError(
            409,
            {
                "error": (
                    "This category cannot be deleted because it has "
                    f"{child_count} subcategories. Remove or reassign them first."
                )
            },
        )

    db.session.delete(category)
    db.session.commit()