import re
import unicodedata
from collections import defaultdict

from ..extensions import db
from ..models import Category, Transaction
from ..schemas.csv_import import CsvParseError, parse_csv_rows
from .errors import ServiceError

WORD_RE = re.compile(r"[a-z0-9]+")
STOPWORDS = frozenset(
    {
        "and", "are", "for", "from", "the", "with",
        "che", "con", "dei", "del", "della", "delle", "dello", "per", "sono", "tra",
    }
)
MIN_TOKEN_LENGTH = 3


def _category_index() -> dict[tuple[str, str], Category]:
    index: dict[tuple[str, str], Category] = {}
    for category in Category.query.all():
        index.setdefault((category.name.lower(), category.type), category)
    return index


def _enabled_category_index() -> dict[tuple[str, str], Category]:
    index: dict[tuple[str, str], Category] = {}
    for category in _enabled_categories():
        index.setdefault((category.name.lower(), category.type), category)
    return index


def _classify_rows(rows: list[dict]) -> tuple[dict[int, Category], set[int]]:
    """Split rows into the ones matching an existing enabled category and the ones
    that still need a category chosen by the user."""
    index = _enabled_category_index()
    resolved: dict[int, Category] = {}
    pending: set[int] = set()
    for row in rows:
        category = None
        if row["category"] is not None:
            category = index.get((row["category"].lower(), row["type"]))
        if category is None:
            pending.add(row["line"])
        else:
            resolved[row["line"]] = category
    return resolved, pending


def _enabled_categories() -> list[Category]:
    return Category.query.filter_by(status="enabled").order_by(Category.name).all()


def _category_options() -> dict[str, list[dict]]:
    """Enabled categories grouped by type, used by the client to assign a category."""
    options: dict[str, list[dict]] = {"income": [], "expense": []}
    for category in _enabled_categories():
        options.setdefault(category.type, []).append({"id": category.id, "name": category.name})
    return options


def _plain_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _tokens(value: str | None) -> set[str]:
    if not value:
        return set()
    return {
        word
        for word in WORD_RE.findall(_plain_text(value))
        if len(word) >= MIN_TOKEN_LENGTH and not word.isdigit() and word not in STOPWORDS
    }


def _suggest_category(row: dict, categories: list[Category]) -> Category | None:
    """Best existing category for a row without a category, or None when nothing matches."""
    notes = row["notes"] or ""
    row_tokens = _tokens(notes)
    if not row_tokens:
        return None
    plain_notes = _plain_text(notes)

    best: Category | None = None
    best_score = 0
    for category in categories:
        if category.type != row["type"]:
            continue
        name = _plain_text(category.name)
        score = 3 * len(row_tokens & _tokens(category.name))
        if name and name in plain_notes:
            score += 5
        score += len(row_tokens & _tokens(category.description))
        if score > best_score:
            best, best_score = category, score
    return best


def _suggested_categories(rows: list[dict], pending: set[int]) -> dict[int, int]:
    """Map CSV line to the id of the category suggested for rows that need a category."""
    categories = _enabled_categories()
    suggestions: dict[int, int] = {}
    for row in rows:
        if row["line"] not in pending:
            continue
        match = _suggest_category(row, categories)
        if match is not None:
            suggestions[row["line"]] = match.id
    return suggestions


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

    valid = list(rows)
    invalid = list(invalid_rows)
    resolved, pending = _classify_rows(valid)
    months, years = _summaries(valid)
    suggestions = _suggested_categories(valid, pending)

    return {
        "total": len(valid),
        "invalid": len(invalid),
        "pending": len(pending),
        "resolved": len(resolved),
        "rows": [
            {
                **row,
                "date": row["date"].isoformat(),
                "matched": row["line"] in resolved,
                "suggested_category_id": suggestions.get(row["line"]),
            }
            for row in valid
        ],
        "invalid_rows": invalid,
        "summary_months": months,
        "summary_years": years,
        "category_options": _category_options(),
    }


def _assignments_by_line(assignments: object) -> dict[int, dict]:
    """Validate the per-row category and note assignments and index them by CSV line."""
    if assignments is None:
        return {}
    if not isinstance(assignments, list):
        raise ServiceError(400, {"errors": {"assignments": "Assignments must be a list"}})

    indexed: dict[int, dict] = {}
    for item in assignments:
        if not isinstance(item, dict):
            raise ServiceError(
                400, {"errors": {"assignments": "Each assignment must be an object"}}
            )
        line = item.get("line")
        if isinstance(line, bool) or not isinstance(line, int):
            raise ServiceError(
                400, {"errors": {"assignments": "Each assignment requires an integer line number"}}
            )
        if line in indexed:
            raise ServiceError(
                400, {"errors": {"assignments": f"Line {line} has more than one assigned category"}}
            )
        category_id = item.get("category_id")
        if category_id is not None and (
            isinstance(category_id, bool) or not isinstance(category_id, int)
        ):
            raise ServiceError(
                400, {"errors": {"assignments": f"Line {line} has an invalid category_id"}}
            )
        name = item.get("category")
        if name is not None and not isinstance(name, str):
            raise ServiceError(
                400, {"errors": {"assignments": f"Line {line} has an invalid category name"}}
            )
        notes = item.get("notes")
        if notes is not None and not isinstance(notes, str):
            raise ServiceError(
                400, {"errors": {"assignments": f"Line {line} has invalid notes"}}
            )
        name = name.strip() if isinstance(name, str) else ""
        if category_id is None and not name:
            raise ServiceError(
                400,
                {
                    "errors": {
                        "assignments": (
                            f"Line {line} must reference an existing category or a new name"
                        )
                    }
                },
            )
        assignment = {"category_id": category_id, "category": name or None}
        if "notes" in item:
            assignment["notes"] = notes.strip() or None
        indexed[line] = assignment
    return indexed


def _assignment_notes(assignment: dict | None, row: dict) -> str | None:
    """Notes typed by the user replace the ones read from the file; omitting them keeps the file value."""
    if assignment is not None and "notes" in assignment:
        return assignment["notes"]
    return row["notes"]


def _category_by_id(category_id: int, type_: str) -> Category:
    category = db.session.get(Category, category_id)
    if category is None:
        raise ServiceError(
            400,
            {"errors": {"assignments": "The category selected for this row no longer exists"}},
        )
    if category.type != type_:
        raise ServiceError(
            400,
            {
                "errors": {
                    "assignments": (
                        f"Category '{category.name}' cannot be used for {type_} transactions"
                    )
                }
            },
        )
    if category.status == "disabled":
        raise ServiceError(
            400,
            {
                "errors": {
                    "assignments": (
                        f"Category '{category.name}' is disabled and cannot receive new transactions"
                    )
                }
            },
        )
    return category


def _category_for_new_name(
    name: str,
    type_: str,
    index: dict[tuple[str, str], Category],
    created: dict[tuple[str, str], Category],
) -> Category:
    """Create the category the user confirmed for a row, reusing an existing one by name."""
    key = (name.lower(), type_)
    existing = index.get(key)
    if existing is not None:
        if existing.status == "disabled":
            raise ServiceError(
                400,
                {
                    "errors": {
                        "assignments": (
                            f"Category '{existing.name}' is disabled and cannot receive "
                            "new transactions"
                        )
                    }
                },
            )
        return existing

    category = Category(
        name=name,
        type=type_,
        status="enabled",
        description="Created by CSV import",
    )
    db.session.add(category)
    db.session.flush()
    index[key] = category
    created[key] = category
    return category


def commit(content: str, assignments: list[dict] | None = None) -> dict:
    try:
        rows, _ = parse_csv_rows(content)
    except CsvParseError as exc:
        raise ServiceError(400, {"errors": {"content": str(exc)}})
    if not rows:
        raise ServiceError(400, {"errors": {"content": "The file does not contain any rows to import"}})

    by_line = _assignments_by_line(assignments)
    resolved, pending = _classify_rows(rows)
    unknown = sorted(set(by_line) - pending)
    if unknown:
        raise ServiceError(
            400,
            {
                "errors": {
                    "assignments": f"Line {unknown[0]} already has a valid category"
                }
            },
        )
    unassigned = sorted(pending - set(by_line))
    if unassigned:
        raise ServiceError(
            400,
            {
                "errors": {
                    "assignments": (
                        f"Choose or create a category for the {len(unassigned)} transaction(s) "
                        f"without a category (first one on line {unassigned[0]})"
                    )
                }
            },
        )

    index = _category_index()
    created: dict[tuple[str, str], Category] = {}
    transactions: list[Transaction] = []

    for row in rows:
        assignment = by_line.get(row["line"])
        if assignment is None:
            category = resolved[row["line"]]
        elif assignment["category_id"] is not None:
            category = _category_by_id(assignment["category_id"], row["type"])
        else:
            category = _category_for_new_name(
                assignment["category"], row["type"], index, created
            )

        transactions.append(
            Transaction(
                type=row["type"],
                category_id=category.id,
                amount=abs(row["amount"]),
                date=row["date"],
                notes=_assignment_notes(assignment, row),
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