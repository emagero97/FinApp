import pytest
from sqlalchemy.exc import IntegrityError

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
        category = Category(name="Old expense", type="expense", status="disabled")
        db.session.add(category)
        db.session.commit()
        return category.id


def _create(client, **overrides):
    payload = {
        "type": "expense",
        "category_id": 1,
        "amount": 12.50,
        "date": "2026-07-15",
        "notes": "weekly shop",
    }
    payload.update(overrides)
    return client.post("/api/transactions", json=payload)


def test_create_transaction(client, expense_category):
    res = _create(client, category_id=expense_category)
    assert res.status_code == 201
    data = res.get_json()
    assert data["amount"] == "12.50"
    assert data["date"] == "2026-07-15"
    assert data["category_name"] == "Groceries"
    assert data["type"] == "expense"


def test_create_income_transaction(client, income_category):
    res = _create(
        client,
        category_id=income_category,
        type="income",
        amount="2500.00",
        notes="July salary",
    )
    assert res.status_code == 201
    assert res.get_json()["type"] == "income"


def test_create_requires_type_and_category(client):
    res = client.post(
        "/api/transactions",
        json={"amount": 10.00, "date": "2026-07-15"},
    )
    assert res.status_code == 400
    assert "type" in res.get_json()["errors"]
    assert "category_id" in res.get_json()["errors"]


def test_create_rejects_zero_amount(client, expense_category):
    res = _create(client, category_id=expense_category, amount=0)
    assert res.status_code == 400
    assert "amount" in res.get_json()["errors"]


def test_create_rejects_negative_amount(client, expense_category):
    res = _create(client, category_id=expense_category, amount=-5)
    assert res.status_code == 400
    assert "amount" in res.get_json()["errors"]


def test_create_rejects_invalid_date(client, expense_category):
    res = _create(client, category_id=expense_category, date="2026/07/15")
    assert res.status_code == 400
    assert "date" in res.get_json()["errors"]


def test_create_rejects_missing_category(client, expense_category):
    res = _create(client, category_id=9999)
    assert res.status_code == 400
    assert "category_id" in res.get_json()["errors"]


def test_create_rejects_type_category_mismatch(client, expense_category):
    res = _create(client, category_id=expense_category, type="income")
    assert res.status_code == 400
    assert "category_id" in res.get_json()["errors"]


def test_create_rejects_disabled_category(client, disabled_category):
    res = _create(client, category_id=disabled_category)
    assert res.status_code == 400
    assert "disabled" in res.get_json()["errors"]["category_id"]


def test_update_transaction(client, expense_category, income_category):
    created = _create(client, category_id=expense_category).get_json()
    res = client.put(
        f"/api/transactions/{created['id']}",
        json={"amount": "20.00", "notes": "updated"},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["amount"] == "20.00"
    assert data["notes"] == "updated"


def test_update_allows_keeping_disabled_category(client, expense_category, disabled_category):
    created = _create(client, category_id=expense_category).get_json()
    tx_id = created["id"]
    with client.application.app_context():
        tx = db.session.get(Transaction, tx_id)
        tx.category_id = disabled_category
        db.session.commit()
    res = client.put(f"/api/transactions/{tx_id}", json={"notes": "keep old category"})
    assert res.status_code == 200
    assert res.get_json()["category_id"] == disabled_category


def test_update_rejects_type_category_mismatch(client, expense_category, income_category):
    created = _create(client, category_id=expense_category).get_json()
    res = client.put(
        f"/api/transactions/{created['id']}",
        json={"category_id": income_category},
    )
    assert res.status_code == 400
    assert "category_id" in res.get_json()["errors"]


def test_delete_transaction(client, expense_category):
    created = _create(client, category_id=expense_category).get_json()
    res = client.delete(f"/api/transactions/{created['id']}")
    assert res.status_code == 204
    with client.application.app_context():
        assert db.session.get(Transaction, created["id"]) is None


def test_list_transactions_with_filters(client, expense_category, income_category):
    _create(client, category_id=expense_category, amount=10.00, date="2026-07-01")
    _create(client, category_id=expense_category, amount=20.00, date="2026-07-20")
    _create(
        client,
        category_id=income_category,
        type="income",
        amount=100.00,
        date="2026-08-01",
        notes="bonus",
    )

    res = client.get("/api/transactions")
    assert res.get_json()["total"] == 3

    res = client.get("/api/transactions?type=income")
    data = res.get_json()
    assert data["total"] == 1
    assert data["transactions"][0]["category_name"] == "Salary"

    res = client.get(f"/api/transactions?category_id={expense_category}")
    assert res.get_json()["total"] == 2

    res = client.get("/api/transactions?date_from=2026-07-15&date_to=2026-07-31")
    data = res.get_json()
    assert data["total"] == 1
    assert data["transactions"][0]["date"] == "2026-07-20"

    res = client.get("/api/transactions?search=bonus")
    assert res.get_json()["total"] == 1


def test_list_default_sorted_by_date_desc(client, expense_category):
    _create(client, category_id=expense_category, date="2026-07-01")
    _create(client, category_id=expense_category, date="2026-07-20")
    data = client.get("/api/transactions").get_json()
    dates = [t["date"] for t in data["transactions"]]
    assert dates == sorted(dates, reverse=True)


def test_list_ascending_sort(client, expense_category):
    _create(client, category_id=expense_category, date="2026-07-20")
    _create(client, category_id=expense_category, date="2026-07-01")
    data = client.get("/api/transactions?sort_dir=asc").get_json()
    assert [t["date"] for t in data["transactions"]] == ["2026-07-01", "2026-07-20"]


def test_db_level_type_match_enforced(app, expense_category, disabled_category):
    with app.app_context():
        category = db.session.get(Category, expense_category)
        with pytest.raises(IntegrityError):
            tx = Transaction(
                type="income",
                category_id=category.id,
                amount=10.00,
                date=__import__("datetime").date.today(),
            )
            db.session.add(tx)
            db.session.commit()
        db.session.rollback()
