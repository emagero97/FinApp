from datetime import date, timedelta

from sqlalchemy import func

from ..extensions import db
from ..models import Category, Transaction


def _fmt(value) -> str:
    return f"{float(value):.2f}"


def _totals(start: date, end: date) -> dict:
    rows = (
        db.session.query(
            Transaction.type, func.coalesce(func.sum(Transaction.amount), 0)
        )
        .filter(Transaction.date >= start, Transaction.date < end)
        .group_by(Transaction.type)
        .all()
    )
    result = {"income": "0.00", "expenses": "0.00"}
    for transaction_type, total in rows:
        result["income" if transaction_type == "income" else "expenses"] = _fmt(total)
    result["balance"] = _fmt(float(result["income"]) - float(result["expenses"]))
    return result


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _category_breakdown(start: date, end: date) -> list[dict]:
    rows = (
        db.session.query(
            Category.id,
            Category.name,
            Category.color,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(Transaction.type == "expense", Transaction.date >= start, Transaction.date < end)
        .group_by(Category.id, Category.name, Category.color)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    return [
        {
            "category_id": category_id,
            "name": name,
            "color": color,
            "total": _fmt(total),
        }
        for category_id, name, color, total in rows
    ]


def _category_comparison(start: date, end: date) -> list[dict]:
    averages = (
        db.session.query(
            Transaction.category_id,
            func.sum(Transaction.amount).label("total"),
            func.count(func.distinct(func.strftime("%Y-%m", Transaction.date))).label("months"),
        )
        .filter(Transaction.type == "expense")
        .group_by(Transaction.category_id)
        .subquery()
    )
    current_rows = (
        db.session.query(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .filter(Transaction.type == "expense", Transaction.date >= start, Transaction.date < end)
        .group_by(Transaction.category_id)
        .all()
    )
    current = {category_id: total for category_id, total in current_rows}

    categories = {c.id: c for c in Category.query.all()}
    items = []
    for row in db.session.query(averages).all():
        category = categories.get(row.category_id)
        if category is None:
            continue
        average = float(row.total) / row.months if row.months else 0.0
        current_total = float(current.get(row.category_id, 0))
        items.append(
            {
                "category_id": category.id,
                "name": category.name,
                "color": category.color,
                "current": _fmt(current_total),
                "average": _fmt(average),
                "above_average": current_total > average,
                "difference": _fmt(current_total - average),
            }
        )
    items.sort(key=lambda item: float(item["current"]), reverse=True)
    return items


def _month_comparison() -> dict:
    today = date.today()
    month = today.month
    year = today.year
    current_total = (
        db.session.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.type == "expense",
            func.strftime("%Y", Transaction.date) == f"{year:04d}",
            func.strftime("%m", Transaction.date) == f"{month:02d}",
        )
        .scalar()
    )

    previous_years = []
    for y in range(year - 5, year):
        total = (
            db.session.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.type == "expense",
                func.strftime("%Y", Transaction.date) == f"{y:04d}",
                func.strftime("%m", Transaction.date) == f"{month:02d}",
            )
            .scalar()
        )
        previous_years.append({"year": y, "total": _fmt(total)})

    non_zero = [float(item["total"]) for item in previous_years if float(item["total"]) > 0]
    average_previous = _fmt(sum(non_zero) / len(non_zero)) if non_zero else None
    return {
        "year": year,
        "month": month,
        "current_total": _fmt(current_total),
        "previous_years": previous_years,
        "average_previous": average_previous,
    }


def _add_months(d: date, n: int) -> date:
    total = d.year * 12 + (d.month - 1) + n
    year, month = divmod(total, 12)
    return date(year, month + 1, 1)


def _monthly_history() -> list[dict]:
    today = date.today()
    months: list[dict] = []
    for offset in range(11, -1, -1):
        first = _add_months(today, -offset)
        next_month = _add_months(today, -offset + 1)
        total = (
            db.session.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.type == "expense",
                Transaction.date >= first,
                Transaction.date < next_month,
            )
            .scalar()
        )
        months.append({"month": _month_key(first), "total": _fmt(total)})
    return months


def build_dashboard() -> dict:
    today = date.today()
    week_start = today - timedelta(days=6)
    month_start = _month_start(today)
    month_end = _add_months(today, 1)
    year_start = today.replace(month=1, day=1)
    year_end = date(today.year + 1, 1, 1)

    return {
        "periods": {
            "week": _totals(week_start, today + timedelta(days=1)),
            "month": _totals(month_start, month_end),
            "year": _totals(year_start, year_end),
        },
        "category_breakdown": _category_breakdown(month_start, month_end),
        "category_comparison": _category_comparison(month_start, month_end),
        "month_comparison": _month_comparison(),
        "monthly_history": _monthly_history(),
    }