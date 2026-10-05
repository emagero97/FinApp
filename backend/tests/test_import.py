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
    assert data["pending"] == 6
    assert data["resolved"] == 0
    assert "new_categories" not in data

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
        "matched": False,
        "suggested_category_id": None,
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
    assert data["pending"] == 0
    assert data["resolved"] == 2
    assert all(row["matched"] for row in data["rows"])
    assert data["rows"][0]["type"] == "expense"
    assert data["rows"][1]["type"] == "income"


def test_preview_matches_category_case_insensitive(client, expense_category):
    csv_text = (
        "data;categoria;importo;note\n"
        "2026-02-10;groceries;-10.5;soup\n"
    )
    res = _post(client, content=csv_text)
    data = res.get_json()
    assert data["pending"] == 0
    assert data["rows"][0]["matched"] is True


def test_preview_disabled_category_row_needs_assignment(client, disabled_category):
    csv_text = "data;categoria;importo;note\n2026-02-10;Legacy Fuel;-10.5;old\n"
    res = _post(client, content=csv_text)
    data = res.get_json()
    assert data["total"] == 1
    assert data["invalid"] == 0
    assert data["pending"] == 1
    assert data["resolved"] == 0
    assert data["rows"][0]["category"] == "Legacy Fuel"
    assert data["rows"][0]["matched"] is False
    assert data["category_options"]["expense"] == []


UNCATEGORIZED_CSV = (
    "data;categoria;importo;note\n"
    "2026-01-02;Svago;-15.0;Bowling friends\n"
    "2026-01-03;;-40.0;benzina\n"
    "2026-01-04;;1200.0;stipendio\n"
)


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
    assert data["total"] == 2
    assert data["invalid"] == 2
    assert data["pending"] == 2
    assert {row["notes"] for row in data["rows"]} == {"no category", "fine"}


def test_preview_marks_rows_without_matching_category_as_pending(client):
    res = _post(client, content=UNCATEGORIZED_CSV)
    data = res.get_json()
    assert data["total"] == 3
    assert data["invalid"] == 0
    assert data["pending"] == 3
    assert data["resolved"] == 0
    assert all(row["matched"] is False for row in data["rows"])

    by_line = {row["line"]: row for row in data["rows"]}
    assert by_line[2]["category"] == "Svago"
    assert by_line[3]["category"] is None
    assert by_line[3]["type"] == "expense"
    assert by_line[4]["category"] is None
    assert by_line[4]["type"] == "income"


def test_preview_returns_enabled_categories_grouped_by_type(
    client, expense_category, income_category, disabled_category
):
    res = _post(client, content=UNCATEGORIZED_CSV)
    options = res.get_json()["category_options"]
    assert [item["name"] for item in options["expense"]] == ["Groceries"]
    assert [item["name"] for item in options["income"]] == ["Freelance"]
    assert all(item["id"] > 0 for group in options.values() for item in group)


def test_preview_accepts_file_without_category_column(client):
    csv_text = "data;importo;note\n2026-02-10;-12.5;soup\n2026-02-11;300;invoice\n"
    res = _post(client, content=csv_text)
    assert res.status_code == 200
    data = res.get_json()
    assert data["total"] == 2
    assert data["pending"] == 2
    assert all(row["category"] is None for row in data["rows"])


def _add_category(app, name, type_, description=None):
    with app.app_context():
        category = Category(name=name, type=type_, status="enabled", description=description)
        db.session.add(category)
        db.session.commit()
        return category.id


def test_preview_suggests_existing_category_matching_the_notes(client):
    groceries = _add_category(client.application, "Groceries", "expense", "supermarket and food")
    _add_category(client.application, "Fuel", "expense", "petrol")

    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;groceries supermarket run\n"
    rows = _post(client, content=csv_text).get_json()["rows"]
    assert rows[0]["suggested_category_id"] == groceries


def test_preview_suggestion_uses_the_description(client):
    fuel = _add_category(client.application, "Fuel", "expense", "petrol station")
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;benzina al petrol station\n"
    rows = _post(client, content=csv_text).get_json()["rows"]
    assert rows[0]["suggested_category_id"] == fuel


def test_preview_suggestion_ignores_categories_of_the_other_type(client):
    income = _add_category(client.application, "Freelance", "income", "invoice")
    _add_category(client.application, "Groceries", "expense", "invoice")

    csv_text = "data;categoria;importo;note\n2026-01-04;;1200.0;invoice\n"
    rows = _post(client, content=csv_text).get_json()["rows"]
    assert rows[0]["suggested_category_id"] == income


def test_preview_suggests_nothing_when_notes_do_not_match(client):
    _add_category(client.application, "Groceries", "expense", "supermarket and food")
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;xyzzy plugh\n"
    rows = _post(client, content=csv_text).get_json()["rows"]
    assert rows[0]["suggested_category_id"] is None


def test_preview_suggests_nothing_when_notes_are_empty(client):
    _add_category(client.application, "Groceries", "expense")
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;\n"
    rows = _post(client, content=csv_text).get_json()["rows"]
    assert rows[0]["suggested_category_id"] is None


def test_preview_suggests_for_rows_whose_category_did_not_match(client):
    groceries = _add_category(client.application, "Groceries", "expense", "supermarket")
    csv_text = "data;categoria;importo;note\n2026-01-03;Bar;-40.0;groceries\n"
    rows = _post(client, content=csv_text).get_json()["rows"]
    assert rows[0]["category"] == "Bar"
    assert rows[0]["matched"] is False
    assert rows[0]["suggested_category_id"] == groceries


def test_preview_never_suggests_for_a_row_that_already_matches(client):
    groceries = _add_category(client.application, "Groceries", "expense", "supermarket")
    csv_text = "data;categoria;importo;note\n2026-01-03;Groceries;-40.0;groceries\n"
    rows = _post(client, content=csv_text).get_json()["rows"]
    assert rows[0]["matched"] is True
    assert rows[0]["suggested_category_id"] is None


def test_preview_suggestion_is_accents_and_case_insensitive(client):
    groceries = _add_category(client.application, "Caffè e Pasticceria", "expense")
    csv_text = "data;categoria;importo;note\n2026-01-03;;-4.5;CAFFE E PASTICCERIA\n"
    rows = _post(client, content=csv_text).get_json()["rows"]
    assert rows[0]["suggested_category_id"] == groceries


def test_commit_accepts_a_suggested_category_id(client):
    groceries = _add_category(client.application, "Groceries", "expense", "supermarket")
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;groceries\n"
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 2, "category_id": groceries}],
    )
    assert res.status_code == 200
    assert res.get_json()["categories_created"] == []
    assert res.get_json()["inserted"] == 1


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


def test_commit_creates_only_the_categories_confirmed_by_assignment(client):
    res = _post(
        client,
        path="/api/import/commit",
        content=EXAMPLE_CSV,
        assignments=[
            {"line": 2, "category": "Svago"},
            {"line": 3, "category": "Veicoli"},
            {"line": 4, "category": "Ristorante"},
            {"line": 5, "category": "Regali"},
            {"line": 6, "category": "Ristorante"},
            {"line": 7, "category": "Bar"},
        ],
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["inserted"] == 6
    assert sorted(data["categories_created"]) == ["Bar", "Regali", "Ristorante", "Svago", "Veicoli"]

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

        # both "Ristorante" rows share the same category
        restaurant = db.session.query(Category).filter_by(name="Ristorante").one()
        restaurant_rows = db.session.query(Transaction).filter_by(category_id=restaurant.id).all()
        assert {tx.notes for tx in restaurant_rows} == {"Sbraciata da Fabio", "McDonald"}


def test_commit_creates_income_categories_for_positive_amounts(client):
    csv_text = "data;categoria;importo;note\n2026-02-12;Freelance;1200;payment\n"
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 2, "category": "Freelance"}],
    )
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
    res = _post(client, path="/api/import/commit", content=csv_text)
    assert res.status_code == 200
    assert res.get_json()["inserted"] == 2
    assert res.get_json()["categories_created"] == []

    _, cat_count = _count_tables(client.application)
    assert cat_count == 2  # unchanged


def test_commit_requires_an_assignment_for_every_unmatched_category(client):
    res = _post(client, path="/api/import/commit", content=EXAMPLE_CSV)
    assert res.status_code == 400
    assert "assignments" in res.get_json()["errors"]
    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 0
    assert cat_count == 0


def test_commit_requires_an_assignment_for_a_disabled_category_row(client, disabled_category):
    csv_text = "data;categoria;importo;note\n2026-02-10;Legacy Fuel;-10.5;old\n"
    res = _post(client, path="/api/import/commit", content=csv_text)
    assert res.status_code == 400
    assert "assignments" in res.get_json()["errors"]
    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 0
    assert cat_count == 1


def test_commit_rejects_a_new_name_matching_a_disabled_category(client, disabled_category):
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n"
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 2, "category": "legacy fuel"}],
    )
    assert res.status_code == 400
    assert "assignments" in res.get_json()["errors"]
    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 0
    assert cat_count == 1


def test_commit_skips_invalid_rows(client):
    csv_text = (
        "data;categoria;importo;note\n"
        "not-a-date;Svago;-15.0;oops\n"
        "2026-01-02;Svago;-15.0;fine\n"
    )
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 3, "category": "Svago"}],
    )
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
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[
            {"line": 2, "category": "Side gig"},
            {"line": 3, "category": "Side gig"},
        ],
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["inserted"] == 2
    assert sorted(data["categories_created"]) == ["Side gig", "Side gig"]

    with client.application.app_context():
        categories = db.session.query(Category).all()
        assert len(categories) == 2
        assert {c.type for c in categories} == {"income", "expense"}


def test_commit_requires_an_assignment_for_every_pending_row(client):
    res = _post(client, path="/api/import/commit", content=UNCATEGORIZED_CSV)
    assert res.status_code == 400
    assert "assignments" in res.get_json()["errors"]
    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 0
    assert cat_count == 0


def test_commit_assigns_existing_categories_to_pending_rows(
    client, expense_category, income_category
):
    res = _post(
        client,
        path="/api/import/commit",
        content=UNCATEGORIZED_CSV,
        assignments=[
            {"line": 2, "category": "Svago"},
            {"line": 3, "category_id": expense_category},
            {"line": 4, "category_id": income_category},
        ],
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["inserted"] == 3
    assert data["categories_created"] == ["Svago"]

    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 3
    assert cat_count == 3

    with client.application.app_context():
        by_notes = {tx.notes: tx for tx in db.session.query(Transaction).all()}
        assert by_notes["benzina"].category_id == expense_category
        assert by_notes["benzina"].amount == 40.0
        assert by_notes["stipendio"].category_id == income_category
        assert by_notes["stipendio"].type == "income"


def test_commit_creates_category_confirmed_by_assignment(client):
    res = _post(
        client,
        path="/api/import/commit",
        content="data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n",
        assignments=[{"line": 2, "category": "Veicoli"}],
    )
    assert res.status_code == 200
    assert res.get_json()["categories_created"] == ["Veicoli"]

    with client.application.app_context():
        tx = db.session.query(Transaction).one()
        category = db.session.get(Category, tx.category_id)
        assert category.name == "Veicoli"
        assert category.type == "expense"
        assert category.status == "enabled"


def test_commit_reuses_the_category_created_for_an_earlier_row(client):
    csv_text = (
        "data;categoria;importo;note\n"
        "2026-01-02;;-15.0;primo\n"
        "2026-01-03;;-20.0;secondo\n"
    )
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[
            {"line": 2, "category": "Veicoli"},
            {"line": 3, "category": "veicoli"},
        ],
    )
    assert res.status_code == 200
    assert res.get_json()["categories_created"] == ["Veicoli"]

    _, cat_count = _count_tables(client.application)
    assert cat_count == 1


def test_commit_assignment_name_reuses_existing_category(client, expense_category):
    res = _post(
        client,
        path="/api/import/commit",
        content="data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n",
        assignments=[{"line": 2, "category": "groceries"}],
    )
    assert res.status_code == 200
    assert res.get_json()["categories_created"] == []

    with client.application.app_context():
        tx = db.session.query(Transaction).one()
        assert tx.category_id == expense_category


def test_commit_rejects_assignment_with_mismatching_type(client, income_category):
    res = _post(
        client,
        path="/api/import/commit",
        content="data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n",
        assignments=[{"line": 2, "category_id": income_category}],
    )
    assert res.status_code == 400
    assert "assignments" in res.get_json()["errors"]
    tx_count, _ = _count_tables(client.application)
    assert tx_count == 0


def test_commit_rejects_assignment_to_disabled_category(client, disabled_category):
    res = _post(
        client,
        path="/api/import/commit",
        content="data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n",
        assignments=[{"line": 2, "category_id": disabled_category}],
    )
    assert res.status_code == 400
    assert "assignments" in res.get_json()["errors"]
    tx_count, _ = _count_tables(client.application)
    assert tx_count == 0


def test_commit_rejects_assignment_for_unknown_category_id(client):
    res = _post(
        client,
        path="/api/import/commit",
        content="data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n",
        assignments=[{"line": 2, "category_id": 9999}],
    )
    assert res.status_code == 400
    assert "assignments" in res.get_json()["errors"]


def test_commit_rejects_assignment_for_row_that_already_has_a_category(client):
    _add_category(client.application, "Svago", "expense")
    _add_category(client.application, "Stipendio", "income")
    res = _post(
        client,
        path="/api/import/commit",
        content=UNCATEGORIZED_CSV,
        assignments=[
            {"line": 2, "category": "Altro"},
            {"line": 3, "category": "Veicoli"},
        ],
    )
    assert res.status_code == 400
    assert "assignments" in res.get_json()["errors"]
    tx_count, _ = _count_tables(client.application)
    assert tx_count == 0


def test_commit_rejects_malformed_assignments(client):
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n"
    for assignments in (
        {"line": 2, "category": "Veicoli"},
        [{"category": "Veicoli"}],
        [{"line": "2", "category": "Veicoli"}],
        [{"line": 2}],
        [{"line": 2, "category": "   "}],
        [{"line": 2, "category": "Veicoli"}, {"line": 2, "category": "Altro"}],
    ):
        res = _post(
            client,
            path="/api/import/commit",
            content=csv_text,
            assignments=assignments,
        )
        assert res.status_code == 400, assignments
        assert "assignments" in res.get_json()["errors"], assignments

    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 0
    assert cat_count == 0


def _notes_by_amount(app):
    with app.app_context():
        return {float(tx.amount): tx.notes for tx in db.session.query(Transaction).all()}


def test_commit_keeps_the_file_note_when_the_assignment_omits_notes(client):
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n"
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 2, "category": "Veicoli"}],
    )
    assert res.status_code == 200
    assert _notes_by_amount(client.application) == {40.0: "benzina"}


def test_commit_stores_the_note_of_the_assignment(client):
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n"
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 2, "category": "Veicoli", "notes": "  carburante Esso  "}],
    )
    assert res.status_code == 200
    assert _notes_by_amount(client.application) == {40.0: "carburante Esso"}


def test_commit_stores_no_note_when_the_assignment_clears_it(client):
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n"
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 2, "category": "Veicoli", "notes": "   "}],
    )
    assert res.status_code == 200
    assert _notes_by_amount(client.application) == {40.0: None}


def test_commit_adds_a_note_to_a_row_without_one(client):
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;\n"
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 2, "category": "Veicoli", "notes": "benzina"}],
    )
    assert res.status_code == 200
    assert _notes_by_amount(client.application) == {40.0: "benzina"}


def test_commit_applies_the_note_to_every_row_of_the_assignment(client):
    csv_text = (
        "data;categoria;importo;note\n"
        "2026-01-03;;-15.0;\n"
        "2026-01-04;;-20.0;\n"
    )
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[
            {"line": 2, "category": "Veicoli", "notes": "carburante"},
            {"line": 3, "category": "Veicoli", "notes": "carburante"},
        ],
    )
    assert res.status_code == 200
    assert _notes_by_amount(client.application) == {15.0: "carburante", 20.0: "carburante"}


def test_commit_never_rewrites_the_note_of_an_automatically_matched_row(client):
    _add_category(client.application, "Groceries", "expense")
    csv_text = (
        "data;categoria;importo;note\n"
        "2026-02-10;Groceries;-10.5;soup\n"
        "2026-02-11;;-20.0;\n"
    )
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 3, "category": "Fuel", "notes": "diesel"}],
    )
    assert res.status_code == 200
    assert _notes_by_amount(client.application) == {10.5: "soup", 20.0: "diesel"}


def test_commit_rejects_an_assignment_with_a_non_string_note(client):
    csv_text = "data;categoria;importo;note\n2026-01-03;;-40.0;benzina\n"
    res = _post(
        client,
        path="/api/import/commit",
        content=csv_text,
        assignments=[{"line": 2, "category": "Veicoli", "notes": 42}],
    )
    assert res.status_code == 400
    assert "assignments" in res.get_json()["errors"]
    tx_count, cat_count = _count_tables(client.application)
    assert tx_count == 0
    assert cat_count == 0