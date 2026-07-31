from .extensions import db
from .models import Category

DEFAULT_CATEGORIES = [
    {"name": "Salary", "type": "income", "color": "#10b981"},
    {"name": "Freelance work", "type": "income", "color": "#06b6d4"},
    {"name": "Groceries", "type": "expense", "color": "#f59e0b"},
    {"name": "Rent", "type": "expense", "color": "#ef4444"},
    {"name": "Transportation", "type": "expense", "color": "#8b5cf6"},
]


def seed_default_categories() -> None:
    if Category.query.count() > 0:
        return
    for item in DEFAULT_CATEGORIES:
        db.session.add(Category(**item))
    db.session.commit()
