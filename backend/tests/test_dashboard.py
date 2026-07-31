from datetime import date

import pytest

import backend.api.dashboard as dashboard_module
from backend.extensions import db
from backend.models import Category, Transaction


class _FakeDate(date):
    @classmethod
    def today(cls):
        return cls(2026, 7, 15)


@pytest.fixture()
def fixed_today(monkeypatch):
    monkeypatch.setattr(dashboard_module, "date", _FakeDate)


@pytest.fixture()
def data(app, fixed_today):
    with app.app_context():
        expense = Category(name="Groceries", type="expense", status="enabled", color="#f59e0b")
        expense2 = Category(name="Rent", type="expense", status="enabled", color="#ef4444")
        income = Category(name="Salary", type="income", status="enabled", color="#10b981")
        db.session.add_all([expense, expense2, income])
        db.session.commit()

        with app.app_context():
            rows = [
                (expense.id, 100.00, "2026-07-15", "expense"),
                (expense.id, 20.00, "2026-07-14", "expense"),
                (expense.id, 30.00, "2026-03-10", "expense"),
                (expense.id, 50.00, "2025-07-10", "expense"),
                (expense2.id, 500.00, "2026-07-15", "expense"),
                (income.id, 2500.00, "2026-07-15", "income"),
            ]
            for category_id, amount, tx_date, tx_type in rows:
                db.session.add(
                    Transaction(
                        type=tx_type,
                        category_id=category_id,
                        amount=amount,
                        date=date.fromisoformat(tx_date),
                        notes="test",
                    )
                )
            db.session.commit()


def test_dashboard_empty(client, fixed_today):
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.get_json()
    for period in ("week", "month", "year"):
        assert data["periods"][period]["income"] == "0.00"
        assert data["periods"][period]["expenses"] == "0.00"
        assert data["periods"][period]["balance"] == "0.00"
    assert data["category_breakdown"] == []
    assert data["category_comparison"] == []
    assert len(data["monthly_history"]) == 12


def test_dashboard_periods(client, data):
    periods = client.get("/api/dashboard").get_json()["periods"]
    assert periods["week"]["income"] == "2500.00"
    assert periods["week"]["expenses"] == "620.00"
    assert periods["week"]["balance"] == "1880.00"
    assert periods["month"]["expenses"] == "620.00"
    # year includes the March transaction
    assert periods["year"]["expenses"] == "650.00"
    assert periods["year"]["income"] == "2500.00"
    assert periods["year"]["balance"] == "1850.00"


def test_dashboard_category_breakdown(client, data):
    breakdown = client.get("/api/dashboard").get_json()["category_breakdown"]
    assert len(breakdown) == 2
    assert breakdown[0]["name"] == "Rent"
    assert breakdown[0]["total"] == "500.00"
    assert breakdown[1]["name"] == "Groceries"
    assert breakdown[1]["total"] == "120.00"


def test_dashboard_category_comparison(client, data):
    items = client.get("/api/dashboard").get_json()["category_comparison"]
    by_name = {item["name"]: item for item in items}
    # Groceries: 120 current month; average = (100+20+30+50) / 3 months = 66.67
    assert by_name["Groceries"]["current"] == "120.00"
    assert by_name["Groceries"]["average"] == "66.67"
    assert by_name["Groceries"]["above_average"] is True


def test_dashboard_month_comparison(client, data):
    comparison = client.get("/api/dashboard").get_json()["month_comparison"]
    assert comparison["year"] == 2026
    assert comparison["month"] == 7
    assert comparison["current_total"] == "620.00"
    prev = {item["year"]: item for item in comparison["previous_years"]}
    assert prev[2025]["total"] == "50.00"
    assert comparison["average_previous"] == "50.00"
