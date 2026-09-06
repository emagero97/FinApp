from datetime import date

TRANSACTION_TYPES = ("income", "expense")
SORTABLE_FIELDS = ("date", "amount", "created_at", "category_name")


def serialize_transaction(transaction, category_name: str | None = None) -> dict:
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


def _parse_date(value) -> date | None:
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def parse_transaction_payload(data: dict, current=None) -> tuple[dict, dict]:
    """Validate a transaction payload. Returns (fields, errors).

    Only syntactic validation is done here; rules that need the database
    (category existence/type match/status, ...) live in the transaction service.
    """
    errors: dict[str, str] = {}
    fields: dict = {}

    if "type" in data or current is None:
        transaction_type = data.get("type")
        if transaction_type not in TRANSACTION_TYPES:
            errors["type"] = "Type must be 'income' or 'expense'"
        else:
            fields["type"] = transaction_type

    if "category_id" in data or current is None:
        category_id = data.get("category_id")
        if not isinstance(category_id, int):
            errors["category_id"] = "A valid category is required"
        else:
            fields["category_id"] = category_id

    if "amount" in data or current is None:
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

    if "date" in data or current is None:
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