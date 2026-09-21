from collections import defaultdict

from ..extensions import db
from ..models import Category, Transaction
from ..schemas.csv_import import CsvParseError, parse_csv_rows
from .errors import ServiceError


def _category_index() -> dict[tuple[str, str], Category]:
    index: dict[tuple[str, str], Category] = {}
    for category in Category.query.all():
        index.setdefault((category.name.lower(), category.type), category)
    return index


def _summaries(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    per_month: dict[str, dict] = defaultdict(lambda: {"count": 0, "income": 0.0, "expenses": 0.0})
    per_year: dict[str, dict] = defaultdict(lambda: {"count": 0, "income": 0.0, "expenses": 0.0})
    for row in rows:
        month = row["date"].strftime("%Y-%m")
        year = row["date"].strftime("%Y")
        per_month[month]["count"] += 1
        per_year[year]["count"] += 1
        if row["amount"] > 0:
            per_month[month]["income"] += row["amount"]
            per_year[year]["income"] += row["amount"]
        else:
            per_month[month]["expenses"] += row["amount"]
            per_year[year]["expenses"] += row["amount"]

    months = [
        {
            "month": month,
            "count": data["count"],
            "income": round(data["income"], 2),
            "expenses": round(data["expenses"], 2),
            "total": round(data["income"] + data["expenses"], 2),
        }
        for month, data in sorted(per_month.items())
    ]
    years = [
        {
            "year": year,
            "count": data["count"],
            "income": round(data["income"], 2),
            "expenses": round(data["expenses"], 2),
            "total": round(data["income"] + data["expenses"], 2),
        }
        for year, data in sorted(per_year.items())
    ]
    return months, years


def preview(content: str) -> dict:
    try:
        rows, invalid_rows = parse_csv_rows(content)
    except CsvParseError as exc:
        raise ServiceError(400, {"errors": {"content": str(exc)}})

    index = _category_index()
    valid: list[dict] = []
    invalid = list(invalid_rows)
    missing: dict[tuple[str, str], dict] = {}

    for row in rows:
        category = index.get((row["category"].lower(), row["type"]))
        if category is not None and category.status == "disabled":
            invalid.append({"line": row["line"], "errors": [f"Category '{category.name}' is disabled"]})
        else:
            if category is None:
                missing.setdefault((row["category"].lower(), row["type"]), row)
            valid.append(row)

    new_categories = [
        {"name": row["category"], "type": row["type"]}
        for (_name, _type), row in sorted(missing.items(), key=lambda item: (item[0][1], item[0][0]))
    ]
    months, years = _summaries(valid)

    return {
        "total": len(valid),
        "invalid": len(invalid),
        "rows": [{**row, "date": row["date"].isoformat()} for row in valid],
        "invalid_rows": invalid,
        "new_categories": new_categories,
        "summary_months": months,
        "summary_years": years,
    }


def commit(content: str, create_categories: bool) -> dict:
    try:
        rows, _ = parse_csv_rows(content)
    except CsvParseError as exc:
        raise ServiceError(400, {"errors": {"content": str(exc)}})
    if not rows:
        raise ServiceError(400, {"errors": {"content": "The file does not contain any rows to import"}})

    index = _category_index()
    created: dict[tuple[str, str], Category] = {}
    transactions: list[Transaction] = []

    for row in rows:
        key = (row["category"].lower(), row["type"])
        category = index.get(key)
        if category is not None:
            if category.status == "disabled":
                raise ServiceError(
                    400,
                    {
                        "errors": {
                            "category": f"Category '{row['category']}' is disabled and cannot receive new transactions"
                        }
                    },
                )
        elif create_categories:
            category = created.get(key)
            if category is None:
                category = Category(
                    name=row["category"],
                    type=row["type"],
                    status="enabled",
                    description="Created by CSV import",
                )
                db.session.add(category)
                db.session.flush()
                created[key] = category
        else:
            raise ServiceError(
                400,
                {
                    "errors": {
                        "create_categories": (
                            "The file references categories that do not exist yet; "
                            "confirm the creation of the missing categories to import."
                        )
                    }
                },
            )

        transactions.append(
            Transaction(
                type=row["type"],
                category_id=category.id,
                amount=abs(row["amount"]),
                date=row["date"],
                notes=row["notes"],
            )
        )

    try:
        db.session.add_all(transactions)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return {
        "inserted": len(transactions),
        "categories_created": [category.name for category in created.values()],
    }