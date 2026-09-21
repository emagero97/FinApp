import csv
import io
from datetime import date

ALIASES = {
    "date": ("data", "date"),
    "category": ("categoria", "category"),
    "amount": ("importo", "amount"),
    "notes": ("note", "notes"),
}


class CsvParseError(ValueError):
    """Raised when the CSV file cannot be parsed as a whole."""


def _normalise_header(value: str) -> str:
    return value.strip().lower()


def _detect_delimiter(text: str) -> str:
    for line in text.splitlines():
        if line.strip():
            delimiters = {candidate: line.count(candidate) for candidate in (";", "\t", ",")}
            return max(delimiters, key=delimiters.get) or ";"
    return ";"


def _map_columns(header: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for index, raw in enumerate(header):
        column = _normalise_header(raw)
        for field, keys in ALIASES.items():
            if column in keys and field not in mapping:
                mapping[field] = index
                break
    return mapping


def _cell(row: list[str], index: int) -> str:
    if index < len(row):
        return row[index].strip()
    return ""


def parse_csv_rows(text: str) -> tuple[list[dict], list[dict]]:
    """Parse CSV content into (valid_rows, invalid_rows).

    valid_rows are dicts of {line, date, category, amount, type, notes};
    invalid_rows are dicts of {line, errors} for rows that fail row-level checks.
    Raises CsvParseError for structural problems (empty file, missing columns).
    """
    text = text.lstrip("\ufeff")
    if not text.strip():
        raise CsvParseError("The file is empty")

    delimiter = _detect_delimiter(text)
    rows = [row for row in csv.reader(io.StringIO(text), delimiter=delimiter) if any(cell.strip() for cell in row)]
    if not rows:
        raise CsvParseError("The file is empty")

    mapping = _map_columns(rows[0])
    missing = [field for field in ALIASES if field not in mapping]
    if missing:
        raise CsvParseError(f"Missing required columns: {', '.join(missing)}")

    parsed: list[dict] = []
    invalid: list[dict] = []
    for index, row in enumerate(rows[1:], start=2):
        errors: list[str] = []

        date_cell = _cell(row, mapping["date"])
        category_cell = _cell(row, mapping["category"])
        amount_cell = _cell(row, mapping["amount"])
        notes_cell = _cell(row, mapping["notes"])

        try:
            tx_date = date.fromisoformat(date_cell)
        except ValueError:
            tx_date = None
            errors.append("Date must use the format YYYY-MM-DD")

        if not category_cell:
            errors.append("Category is required")

        try:
            amount = round(float(amount_cell.replace(",", ".")), 2)
        except ValueError:
            amount = None
            errors.append("Amount must be a number")
        if amount is not None and amount == 0:
            errors.append("Amount must not be zero")

        if errors:
            invalid.append({"line": index, "errors": errors})
            continue

        parsed.append(
            {
                "line": index,
                "date": tx_date,
                "category": category_cell,
                "amount": amount,
                "type": "income" if amount > 0 else "expense",
                "notes": notes_cell or None,
            }
        )

    return parsed, invalid