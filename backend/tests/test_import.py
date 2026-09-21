import pytest

from backend.extensions import db
from backend.models import Category, Transaction

EXAMPLE_CSV = (
    "data;categoria;importo;note\n"
    "2026-01-02;Svago;-15.0;Bowling friends\n"
    "2026-01-05;Veicoli;-40.0;benzina\n"
    "2026-01-05;Ristorante;-20.0;Sbraciata da Fabio\n"
    "2026-01-06;Regali;-30.0;Bottiglia nonni melix\n"
    "2026-01-10;Ristorante;-30.0;McDonald\n"
    "2026-01-10;Bar;-7.0;Colazione Friends\n"
)


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
        category = Category(name="Freelance", type="income", status="enabled")
        db.session.add(category)
        db.session.commit()
        return category.id


@pytest.fixture()
def disabled_category(app):
    with app.app_context():
        category = Category(name="Legacy Fuel", type="expense", status="disabled")
        db.session.add(category)
        db.session.commit()
        return category.id


def _count_tables(app):
    with app.app_context():
        return (
            db.session.query(Transaction).count(),
            db.session.query(Category).count(),
        )


def _post(client, path="/api/import", **payload):
    return client.post(path, json=payload)


def test_preview_full_parse(client):
    res = _post(client, content=EXAMPLE_CSV)
    assert res.status_code == 200
    data = res.get_json()
    assert data["total"] == 6
    assert data["invalid"] == 0
    assert len(data["new_categories"]) == 5  # Svago, Veicoli, Ristorante, Regali, Bar

    names = {item["name"] for item in data["new_categories"]}
    assert names == {"Svago", "Veicoli", "Ristorante", "Regali", "Bar"}
    assert all(item["type"] == "expense" for item in data["new_categories"])

    assert data["summary_months"] == [
        {
            "month": "2026-01",
            "count": 6,
            "income": 0.0,
            "expenses": -142.0,
            "total": -142.0,
        }
    ]
    assert data["summary_years"] == [
        {
            "year": "2026",
            "count": 6,
            "income": 0.0,
            "expenses": -142.0,
            "total": -142.0,
        }
    ]

    assert data["rows"][0] == {
        "line": 2,
        "date": "2026-01-02",
        "category": "Svago",
        "type": "expense",
        "amount": -15.0,
        "notes": "Bowling friends",
    }


def test_preview_summary_nets_income_minus_expenses(client):
    csv_text = (
        "data;categoria;importo;note\n"
        "2026-01-02;Svago;-15.0;Bowling friends\n"
        "2026-01-05;Veicoli;-40.0;benzina\n"
        "2026-01-05;Stipendio;1400.0;stipendio mensile\n"
        "2026-01-10;Ristorante;-30.0;McDonald\n"
        "2026-01-11;Bonus;100.0;extra\n"
    )
    res = _post(client, content=csv_text)
    assert res.status_code == 200
    data = res.get_json()
    assert data["total"] == 5
    # income (1400 + 100) minus expenses (15 + 40 + 30) = 1415.0 (net), NOT |sum| = 1585.0
    assert data["summary_months"] == [
        {
            "month": "2026-01",
            "count": 5,
            "income": 1500.0,
            "expenses": -85.0,
            "total": 1415.0,
        }
    ]
    assert data["summary_years"] == [
        {
            "year": "2026",
            "count": 5,
            "income": 1500.0,
            "expenses": -85.0,
            "total": 1415.0,
        }
    ]


def test_preview_uses_existing_enabled_categories(client, expense_category, income_category):
    csv_text = (
        "data;categoria;importo;note\n"
        "2026-02-10;Groceries;-10.5;soup\n"
        "2026-02-11;Freelance;500;invoice\n"
    )
    res = _post(client, content=csv_text)
    assert res.status_code == 200
    data = res.get_json()
    assert data["total"] == 2
    assert data["new_categories"] == []
    assert data["rows"][0]["type"] == "expense"
    assert data["rows"][1]["type"] == "income"


def test_preview_matches_category_case_insensitive(client, expense_category):
    csv_text = (
        "data;categoria;importo;note\n"
        "2026-02-10;groceries;-10.5;soup\n"
    )
    res = _post(client, content=csv_text)
    assert res.get_json()["new_categories"] == []


def test_preview_disabled_category_row_is_invalid(client, disabled_category):
    csv_text = "data;categoria;importo;note\n2026-02-10;Legacy Fuel;-10.5;old\n"
    res = _post(client, content=csv_text)
    data = res.get_json()
    assert data["total"] == 0
    assert data["invalid"] == 1
    assert "Legacy Fuel" in data["invalid_rows"][0]["errors"][0]


def test_preview_invalid_rows_reported(client):
    csv_text = (
        "data;categoria;importo;note\n"
        "not-a-date;Svago;-15.0;oops\n"
        "2026-01-02;;-15.0;no category\n"
        "2026-01-02;Svago;0;zero\n"
        "2026-01-02;Svago;-15.0;fine\n"
    )
    res = _post(client, content=csv_text)
    data = res.get_json()
    assert data["total"] == 1
    assert data["invalid"] == 3
    assert data["rows"][0]["notes"] == "fine"


def test_preview_missing_columns_returns_400(client):
    res = _post(client, content="foo;bar\n1;2\n")
    assert res.status_code == 400
    assert "content" in res.get_json()["errors"]


def test_preview_empty_file_returns_400(client):
    res = _post(client, content="")
    assert res.status_code == 400
    assert "content" in res.get_json()["errors"]


def test_preview_handles_utf8_bom(client):
    res = _post(client, content="\ufeff" + EXAMPLE_CSV)
    data = res.get_json()
    assert data["total"] == 6
    assert data["summary_months"][0]["count"] == 6


def test_preview_handles_comma_delimiter(client):
    csv_text = (
        "data,categoria,importo,note\n"
        "2026-03-01,Bar,-7.5,colazione\n"
    )
    res = _post(client, content=csv_text)
    assert res.status_code == 200
    data = res.get_json()
    assert data["total"] == 1
    assert data["rows"][0]["amount"] == -7.5


def test_commit_creates_categories_and_transactions(client):
    res = _post(client, path="/api/import/commit", content=EXAMPLE_CSV, create_categories=True)
    assert res.status_code == 200
    data = res.get_json()
    assert data["inserted"] == 6
    assert len(data["categories_created"]) == 5

    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 6
    assert cat_count == 5

    with client.application.app_context():
        first = db.session.query(Transaction).order_by(Transaction.id).first()
        assert first.type == "expense"
        assert first.amount == 15.0
        assert first.date.isoformat() == "2026-01-02"
        assert first.notes == "Bowling friends"
        category = db.session.get(Category, first.category_id)
        assert category.name == "Svago"
        assert category.type == "expense"
        assert category.status == "enabled"


def test_commit_creates_income_categories_for_positive_amounts(client):
    csv_text = "data;categoria;importo;note\n2026-02-12;Freelance;1200;payment\n"
    res = _post(client, path="/api/import/commit", content=csv_text, create_categories=True)
    assert res.status_code == 200
    assert res.get_json()["inserted"] == 1

    with client.application.app_context():
        tx = db.session.query(Transaction).one()
        category = db.session.get(Category, tx.category_id)
        assert tx.type == "income"
        assert tx.amount == 1200.0
        assert category.type == "income"


def test_commit_uses_existing_categories_without_creating(client, expense_category, income_category):
    csv_text = (
        "data;categoria;importo;note\n"
        "2026-02-10;Groceries;-10.5;soup\n"
        "2026-02-11;Freelance;500;invoice\n"
    )
    res = _post(client, path="/api/import/commit", content=csv_text, create_categories=False)
    assert res.status_code == 200
    assert res.get_json()["inserted"] == 2
    assert res.get_json()["categories_created"] == []

    _, cat_count = _count_tables(client.application)
    assert cat_count == 2  # unchanged


def test_commit_requires_category_creation_approval(client):
    res = _post(client, path="/api/import/commit", content=EXAMPLE_CSV, create_categories=False)
    assert res.status_code == 400
    assert "create_categories" in res.get_json()["errors"]
    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 0
    assert cat_count == 0


def test_commit_rejects_disabled_category_even_when_approved(client, disabled_category):
    csv_text = "data;categoria;importo;note\n2026-02-10;Legacy Fuel;-10.5;old\n"
    res = _post(client, path="/api/import/commit", content=csv_text, create_categories=True)
    assert res.status_code == 400
    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 0
    assert cat_count == 1


def test_commit_skips_invalid_rows(client):
    csv_text = (
        "data;categoria;importo;note\n"
        "not-a-date;Svago;-15.0;oops\n"
        "2026-01-02;Svago;-15.0;fine\n"
    )
    res = _post(client, path="/api/import/commit", content=csv_text, create_categories=True)
    assert res.status_code == 200
    assert res.get_json()["inserted"] == 1

    tx_count, _ = _count_tables(client.application)
    assert tx_count == 1

    with client.application.app_context():
        tx = db.session.query(Transaction).one()
        assert tx.notes == "fine"


def test_commit_two_categories_same_name_different_types(client):
    csv_text = (
        "data;categoria;importo;note\n"
        "2026-04-01;Side gig;-20;cost\n"
        "2026-04-02;Side gig;300;revenue\n"
    )
    res = _post(client, path="/api/import/commit", content=csv_text, create_categories=True)
    assert res.status_code == 200
    data = res.get_json()
    assert data["inserted"] == 2
    assert sorted(data["categories_created"]) == ["Side gig", "Side gig"]

    with client.application.app_context():
        categories = db.session.query(Category).all()
        assert len(categories) == 2
        assert {c.type for c in categories} == {"income", "expense"}