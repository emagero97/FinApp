import calendar
from datetime import date

from sqlalchemy import or_

from ..extensions import db
from ..models import Category, Transaction

TRANSACTION_TYPES = ("income", "expense")


def _parse_date(value) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _month_range(year_month: str) -> tuple[date, date] | None:
    parts = year_month.split("-")
    if len(parts) != 2:
        return None
    try:
        year, month = (int(x) for x in parts)
    except ValueError:
        return None
    if not (1 <= month <= 12):
        return None
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def resolve_types(args) -> list[str]:
    raw = (args.get("type") or args.get("types") or "both").strip().lower()
    values = [v.strip() for v in raw.split(",") if v.strip()]
    if not values or "both" in values:
        return ["income", "expense"]
    return [v for v in TRANSACTION_TYPES if v in values]


def _resolve_ranges(args) -> tuple[list[tuple[date, date]], dict]:
    """Return a list of inclusive date ranges plus any validation errors."""
    ranges: list[tuple[date, date]] = []
    errors: dict = {}

    custom = "date_from" in args or "date_to" in args
    if custom:
        date_from = _parse_date(args.get("date_from"))
        date_to = _parse_date(args.get("date_to"))
        if date_from is None:
            errors["date_from"] = "date_from must use the format YYYY-MM-DD"
        if date_to is None:
            errors["date_to"] = "date_to must use the format YYYY-MM-DD"
        if date_from is not None and date_to is not None:
            if date_from > date_to:
                errors["date_from"] = "date_from must not be after date_to"
            elif not errors:
                ranges.append((date_from, date_to))

    month = (args.get("month") or "").strip()
    if month:
        rng = _month_range(month)
        if rng is None:
            errors["month"] = "month must use the format YYYY-MM"
        else:
            ranges.append(rng)

    months = (args.get("months") or "").strip()
    if months:
        for item in [m.strip() for m in months.split(",") if m.strip()]:
            rng = _month_range(item)
            if rng is None:
                errors.setdefault("months", []).append(item)
            else:
                ranges.append(rng)

    year = (args.get("year") or "").strip()
    if year:
        try:
            y = int(year)
            if not 1 <= y <= 9999:
                raise ValueError
        except ValueError:
            errors["year"] = "year must be a valid 4-digit year"
        else:
            ranges.append((date(y, 1, 1), date(y, 12, 31)))

    return ranges, errors


def _parse_int_list(value) -> list[int] | None:
    if not value:
        return None
    parts = [p.strip() for p in value.split(",") if p.strip()]
    if not parts:
        return None
    result: list[int] = []
    for part in parts:
        try:
            result.append(int(part))
        except ValueError:
            raise ValueError(part)
    return result


def apply_filters(args) -> tuple[object | None, dict]:
    """Return a query over (Transaction, Category.name) plus validation errors."""
    errors: dict = {}

    ranges, range_errors = _resolve_ranges(args)
    errors.update(range_errors)

    try:
        include = _parse_int_list(args.get("include_category_ids"))
    except ValueError:
        errors["include_category_ids"] = "include_category_ids must be a comma-separated list of ids"
        include = None

    try:
        exclude = _parse_int_list(args.get("exclude_category_ids"))
    except ValueError:
        errors["exclude_category_ids"] = "exclude_category_ids must be a comma-separated list of ids"
        exclude = None

    if errors:
        return None, errors

    query = db.session.query(Transaction, Category.name.label("category_name")).join(
        Category, Category.id == Transaction.category_id
    )

    if ranges:
        conditions = [
            (Transaction.date >= start) & (Transaction.date <= end) for start, end in ranges
        ]
        query = query.filter(or_(*conditions))

    types = resolve_types(args)
    query = query.filter(Transaction.type.in_(types))

    if include:
        query = query.filter(Transaction.category_id.in_(include))
    if exclude:
        query = query.filter(~Transaction.category_id.in_(exclude))

    return query.order_by(Transaction.date.asc(), Transaction.id.asc()), errors