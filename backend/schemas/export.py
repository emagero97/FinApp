import csv
import io

CSV_HEADERS_BY_LANG = {
    "en": [
        "transaction ID",
        "transaction date",
        "transaction type",
        "category name",
        "amount",
        "notes",
        "created at",
        "updated at",
    ],
    "it": [
        "ID transazione",
        "Data transazione",
        "Tipo di transazione",
        "Categoria",
        "Importo",
        "Note",
        "Creata il",
        "Aggiornata il",
    ],
}

CSV_TYPE_BY_LANG = {
    "en": {"income": "income", "expense": "expense"},
    "it": {"income": "Entrata", "expense": "Uscita"},
}


def headers_for(lang: str) -> list[str]:
    return CSV_HEADERS_BY_LANG.get(lang, CSV_HEADERS_BY_LANG["en"])


def type_label(lang: str, transaction_type: str) -> str:
    labels = CSV_TYPE_BY_LANG.get(lang, CSV_TYPE_BY_LANG["en"])
    return labels.get(transaction_type, transaction_type)


def to_csv(rows: list[tuple], lang: str) -> str:
    """Render (Transaction, category_name) rows into a CSV body (without BOM)."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\n")
    writer.writerow(headers_for(lang))
    for transaction, category_name in rows:
        writer.writerow(
            [
                transaction.id,
                transaction.date.isoformat() if transaction.date else "",
                type_label(lang, transaction.type),
                category_name if category_name else "",
                "{:.2f}".format(transaction.amount),
                transaction.notes or "",
                (
                    transaction.created_at.strftime("%Y-%m-%d %H:%M:%S")
                    if transaction.created_at
                    else ""
                ),
                (
                    transaction.updated_at.strftime("%Y-%m-%d %H:%M:%S")
                    if transaction.updated_at
                    else ""
                ),
            ]
        )
    return buffer.getvalue()