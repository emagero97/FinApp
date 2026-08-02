import pytest
from datetime import date

from backend.extensions import db
from backend.models import Category, Transaction


@pytest.fixture()
def expense_category(app):
    with app.app_context():
        category = Category(name="Groceries", type="expense", status="enabled")
        db.session.add(category)
        db.session.commit()
        return category.id


@pytest.fixture()
def income_category(app):
    with app.app_context():
        category = Category(name="Salary", type="income", status="enabled")
        db.session.add(category)
        db.session.commit()
        return category.id


@pytest.fixture()
def disabled_category(app):
    with app.app_context():
        category = Category(name="Legacy Fuel", type="expense", status="disabled", color="#000")
        db.session.add(category)
        db.session.commit()
        return category.id


def _seed(client, category_id, transaction_type, amount, tx_date, notes="some notes"):
    with client.application.app_context():
        tx = Transaction(
            type=transaction_type,
            category_id=category_id,
            amount=amount,
            date=date.fromisoformat(tx_date),
            notes=notes,
        )
        db.session.add(tx)
        db.session.commit()
        return tx.id


def test_export_no_rows_returns_404(client, expense_category):
    res = client.get("/api/export/download")
    assert res.status_code == 404
    assert res.get_json()["count"] == 0


def test_export_preview_count(client, expense_category, income_category):
    _seed(client, expense_category, "expense", 10.00, "2026-07-01", "bread")
    _seed(client, expense_category, "expense", 20.00, "2026-07-15", "milk")
    _seed(client, income_category, "income", 100.00, "2026-08-01", "bonus")

    res = client.get("/api/export")
    assert res.status_code == 200
    assert res.get_json()["count"] == 3

    res = client.get("/api/export?type=expense")
    assert res.get_json()["count"] == 2

    res = client.get("/api/export?date_from=2026-07-01&date_to=2026-07-31")
    assert res.get_json()["count"] == 2

    res = client.get("/api/export?month=2026-07")
    assert res.get_json()["count"] == 2

    res = client.get("/api/export?year=2026")
    assert res.get_json()["count"] == 3


def test_export_custom_range_inclusive(client, expense_category):
    _seed(client, expense_category, "expense", 10.00, "2026-07-01", "start")
    _seed(client, expense_category, "expense", 20.00, "2026-07-31", "end")
    res = client.get("/api/export?date_from=2026-07-01&date_to=2026-07-31")
    assert res.get_json()["count"] == 2


def test_export_invalid_custom_range(client, expense_category):
    _seed(client, expense_category, "expense", 10.00, "2026-07-01", "x")
    res = client.get("/api/export?date_from=2026-08-01&date_to=2026-07-01")
    assert res.status_code == 400
    assert "date_from" in res.get_json()["errors"]


def test_export_multiple_months_and_year(client, expense_category):
    _seed(client, expense_category, "expense", 10.00, "2026-06-10", "jun")
    _seed(client, expense_category, "expense", 20.00, "2026-07-10", "jul")
    _seed(client, expense_category, "expense", 30.00, "2025-03-10", "older")

    res = client.get("/api/export?months=2026-06,2026-07")
    assert res.get_json()["count"] == 2

    res = client.get("/api/export?year=2025")
    assert res.get_json()["count"] == 1


def test_export_category_filter_include_exclude(client, expense_category, income_category):
    _seed(client, expense_category, "expense", 10.00, "2026-07-01", "groceries")
    _seed(client, income_category, "income", 100.00, "2026-07-02", "salary")

    res = client.get(f"/api/export?include_category_ids={expense_category}")
    assert res.get_json()["count"] == 1

    res = client.get(f"/api/export?exclude_category_ids={income_category}")
    assert res.get_json()["count"] == 1


def test_export_disabled_categories_still_exportable(
    client, expense_category, disabled_category
):
    _seed(client, disabled_category, "expense", 42.50, "2026-07-01", "legacy fuel")
    _seed(client, expense_category, "expense", 7.30, "2026-07-02", "groceries")

    res = client.get(f"/api/export?include_category_ids={disabled_category}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["count"] == 1


def test_export_csv_format(client, expense_category):
    _seed(client, expense_category, "expense", 12.5, "2026-07-15", 'note; with "quotes" and\n newline')

    res = client.get("/api/export/download?type=expense")
    assert res.status_code == 200
    body = res.data.decode("utf-8")
    # BOM prefix
    assert body.startswith("\ufeff")
    assert '"note; with ""quotes"" and\n newline"' in body
    assert "\n" in body
    assert "2026-07-15" in body
    assert "12.50" in body
    assert res.headers["X-Total-Count"] == "1"
    assert res.headers["Content-Type"].startswith("text/csv")


def test_export_csv_ordering_ascending(client, expense_category):
    _seed(client, expense_category, "expense", 10.00, "2026-07-20", "later")
    _seed(client, expense_category, "expense", 20.00, "2026-07-01", "earlier")

    res = client.get("/api/export/download?type=expense")
    body = res.data.decode("utf-8")
    assert body.index("earlier") < body.index("later")


def test_export_csv_italian_headers(client, expense_category):
    _seed(client, expense_category, "expense", 12.50, "2026-07-15", "spesa")

    res = client.get("/api/export/download?type=expense&lang=it")
    assert res.status_code == 200
    body = res.data.decode("utf-8")
    assert "ID transazione;Data transazione;Tipo di transazione;Categoria;Importo;Note;Creata il;Aggiornata il" in body
    assert "Uscita" in body
    assert "1;2026-07-15;Uscita;" in body


def test_export_csv_english_headers_default(client, expense_category):
    _seed(client, expense_category, "expense", 12.50, "2026-07-15", "spesa")

    res = client.get("/api/export/download?type=expense")
    body = res.data.decode("utf-8")
    assert "transaction ID;transaction date;transaction type;category name;amount" in body
    assert "ID transazione" not in body


def test_export_csv_italian_income_type(client, income_category):
    _seed(client, income_category, "income", 2500.00, "2026-07-01", "stipendio")

    res = client.get("/api/export/download?lang=it")
    body = res.data.decode("utf-8")
    assert "Entrata" in body
    assert "1;2026-07-01;Entrata;" in body

    res = client.get("/api/export/download")
    body = res.data.decode("utf-8")
    assert "1;2026-07-01;income;" in body


def test_export_filename_uses_range(client, expense_category):
    _seed(client, expense_category, "expense", 10.00, "2026-07-01", "a")
    _seed(client, expense_category, "expense", 20.00, "2026-07-31", "b")

    res = client.get("/api/export/download?type=expense")
    disposition = res.headers["Content-Disposition"]
    assert "transactions_2026-07-01_2026-07-31.csv" in disposition