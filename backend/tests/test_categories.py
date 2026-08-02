from datetime import date, datetime, timezone

from backend.extensions import db
from backend.models import Category, Transaction
from backend.seed import seed_default_categories


def _create_category(client, **overrides):
    payload = {"name": "Groceries", "type": "expense", "status": "enabled"}
    payload.update(overrides)
    return client.post("/api/categories", json=payload)


def test_list_empty_by_default(client):
    res = client.get("/api/categories")
    assert res.status_code == 200
    assert res.get_json()["total"] == 0


def test_seed_default_categories(client, app):
    with app.app_context():
        seed_default_categories()
    res = client.get("/api/categories")
    assert res.status_code == 200
    data = res.get_json()
    assert data["total"] == 5
    names = {c["name"] for c in data["categories"]}
    assert {"Salary", "Rent", "Groceries"} <= names


def test_create_category(client):
    res = _create_category(client)
    assert res.status_code == 201
    data = res.get_json()
    assert data["name"] == "Groceries"
    assert data["type"] == "expense"
    assert data["status"] == "enabled"
    assert data["transaction_count"] == 0


def test_create_category_blank_name_rejected(client):
    res = _create_category(client, name="   ")
    assert res.status_code == 400
    assert "name" in res.get_json()["errors"]


def test_create_category_missing_type_rejected(client):
    payload = {"name": "Salary"}
    res = client.post("/api/categories", json=payload)
    assert res.status_code == 400
    assert "type" in res.get_json()["errors"]


def test_duplicate_name_same_type_rejected(client):
    _create_category(client)
    res = _create_category(client)
    assert res.status_code == 409
    assert "name" in res.get_json()["errors"]


def test_same_name_different_type_allowed(client):
    _create_category(client)
    res = _create_category(client, type="income")
    assert res.status_code == 201


def test_duplicate_check_is_case_insensitive(client):
    _create_category(client)
    res = _create_category(client, name="groceries")
    assert res.status_code == 409


def test_update_category(client, app):
    created = _create_category(client).get_json()
    res = client.put(
        f"/api/categories/{created['id']}",
        json={"name": "Supermarket", "status": "disabled"},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["name"] == "Supermarket"
    assert data["status"] == "disabled"


def test_type_change_allowed_when_no_transactions(client, app):
    created = _create_category(client).get_json()
    res = client.put(f"/api/categories/{created['id']}", json={"type": "income"})
    assert res.status_code == 200
    assert res.get_json()["type"] == "income"


def test_type_change_blocked_with_transactions(client, app, add_transaction):
    created = _create_category(client).get_json()
    with app.app_context():
        category = db.session.get(Category, created["id"])
        add_transaction(category)
    res = client.put(f"/api/categories/{created['id']}", json={"type": "income"})
    assert res.status_code == 409
    assert "type" in res.get_json()["errors"]


def test_delete_blocked_with_transactions(client, app, add_transaction):
    created = _create_category(client).get_json()
    with app.app_context():
        category = db.session.get(Category, created["id"])
        add_transaction(category)
    res = client.delete(f"/api/categories/{created['id']}")
    assert res.status_code == 409
    assert "cannot be deleted" in res.get_json()["error"]
    with app.app_context():
        assert db.session.get(Category, created["id"]) is not None


def test_delete_allowed_without_transactions(client, app):
    created = _create_category(client).get_json()
    res = client.delete(f"/api/categories/{created['id']}")
    assert res.status_code == 204
    with app.app_context():
        assert db.session.get(Category, created["id"]) is None


def test_disable_keeps_transactions(client, app, add_transaction):
    created = _create_category(client).get_json()
    with app.app_context():
        category = db.session.get(Category, created["id"])
        tx_id = add_transaction(category)
    res = client.put(f"/api/categories/{created['id']}", json={"status": "disabled"})
    assert res.status_code == 200
    assert res.get_json()["status"] == "disabled"
    with app.app_context():
        assert db.session.get(Transaction, tx_id) is not None


def test_category_stats(client, app, add_transaction):
    created = _create_category(client).get_json()
    with app.app_context():
        category = db.session.get(Category, created["id"])
        add_transaction(category, amount=25.50)
        add_transaction(category, amount=10.00)
    res = client.get(f"/api/categories/{created['id']}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["transaction_count"] == 2
    assert data["total_amount"] == "35.50"
    assert data["last_transaction_date"] is not None


def test_list_search_filter(client, app):
    _create_category(client, name="Groceries")
    _create_category(client, name="Rent", type="expense")
    _create_category(client, name="Salary", type="income")

    res = client.get("/api/categories?search=rent")
    data = res.get_json()
    assert [c["name"] for c in data["categories"]] == ["Rent"]

    res = client.get("/api/categories?type=income")
    data = res.get_json()
    assert all(c["type"] == "income" for c in data["categories"])

    res = client.get("/api/categories?status=disabled")
    data = res.get_json()
    assert all(c["status"] == "disabled" for c in data["categories"])


def test_list_sort_by_name_desc(client, app):
    _create_category(client, name="Banana")
    _create_category(client, name="Apple")
    res = client.get("/api/categories?sort_by=name&sort_dir=desc")
    names = [c["name"] for c in res.get_json()["categories"]]
    assert names == sorted(names, reverse=True)


def test_get_missing_category_returns_404(client):
    res = client.get("/api/categories/9999")
    assert res.status_code == 404


def test_invalid_filter_type(client):
    res = client.get("/api/categories?type=bogus")
    assert res.status_code == 400


def test_create_subcategory(client):
    parent = _create_category(client, name="Food").get_json()
    res = client.post(
        "/api/categories",
        json={"name": "Groceries", "type": "expense", "status": "enabled", "parent_id": parent["id"]},
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["parent_id"] == parent["id"]
    assert data["parent_name"] == "Food"
    assert data["child_count"] == 0

    parent_res = client.get(f"/api/categories/{parent['id']}")
    assert parent_res.get_json()["child_count"] == 1


def test_create_subcategory_parent_missing(client):
    res = _create_category(client, parent_id=9999)
    assert res.status_code == 400
    assert "parent_id" in res.get_json()["errors"]


def test_create_subcategory_type_mismatch(client):
    parent = _create_category(client, name="Salary", type="income").get_json()
    res = _create_category(client, parent_id=parent["id"])
    assert res.status_code == 400
    assert "parent_id" in res.get_json()["errors"]


def test_create_duplicate_subcategory_same_parent(client, app):
    parent = _create_category(client, name="Food").get_json()
    _create_category(client, name="Groceries", parent_id=parent["id"])
    res = _create_category(client, name="groceries", parent_id=parent["id"])
    assert res.status_code == 409
    assert "name" in res.get_json()["errors"]


def test_same_subcategory_name_different_parent_allowed(client):
    p1 = _create_category(client, name="Food").get_json()
    p2 = _create_category(client, name="Family").get_json()
    res1 = _create_category(client, name="Groceries", parent_id=p1["id"])
    assert res1.status_code == 201
    res2 = _create_category(client, name="Groceries", parent_id=p2["id"])
    assert res2.status_code == 201


def test_category_cannot_be_own_parent(client, app):
    created = _create_category(client).get_json()
    res = client.put(f"/api/categories/{created['id']}", json={"parent_id": created["id"]})
    assert res.status_code == 400
    assert "parent_id" in res.get_json()["errors"]


def test_delete_parent_with_children_blocked(client):
    parent = _create_category(client, name="Food").get_json()
    _create_category(client, name="Groceries", parent_id=parent["id"])
    res = client.delete(f"/api/categories/{parent['id']}")
    assert res.status_code == 409
    assert "subcategories" in res.get_json()["error"]


def test_parent_type_change_blocked_with_children(client, app):
    parent = _create_category(client, name="Food").get_json()
    client.post(
        "/api/categories",
        json={"name": "Groceries", "type": "expense", "status": "enabled", "parent_id": parent["id"]},
    )
    res = client.put(f"/api/categories/{parent['id']}", json={"type": "income"})
    assert res.status_code == 409
    assert "type" in res.get_json()["errors"]
