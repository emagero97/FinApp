import pytest

from backend.app import create_app
from backend.extensions import db
from backend.models import Transaction


@pytest.fixture()
def app():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SEED_DEFAULT_CATEGORIES": False,
        }
    )
    yield app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def add_transaction(app):
    def _add(category, amount=10.0, transaction_type=None):
        with app.app_context():
            tx = Transaction(
                type=transaction_type or category.type,
                category_id=category.id,
                amount=amount,
                date=__import__("datetime").date.today(),
                notes="test",
            )
            db.session.add(tx)
            db.session.flush()
            tx_id = tx.id
            db.session.commit()
            return tx_id

    return _add
