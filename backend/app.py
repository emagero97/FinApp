import sqlite3
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS

from .api import categories_bp, dashboard_bp, transactions_bp
from .extensions import db
from .seed import seed_default_categories

BASE_DIR = Path(__file__).resolve().parent


def _migrate_schema(app) -> None:
    """Add columns missing from an existing SQLite database (create_all() adds nothing)."""
    db_path = app.config["SQLALCHEMY_DATABASE_URI"].replace("sqlite:///", "")
    if db_path.startswith(":memory:") or not Path(db_path).exists():
        return
    conn = sqlite3.connect(db_path)
    try:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(categories)")}
        if "parent_id" not in cols:
            conn.execute("ALTER TABLE categories ADD COLUMN parent_id INTEGER")
        conn.commit()
    finally:
        conn.close()


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{BASE_DIR / 'finapp.db'}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SEED_DEFAULT_CATEGORIES"] = True
    if config:
        app.config.update(config)

    CORS(app)
    db.init_app(app)

    app.register_blueprint(categories_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(dashboard_bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    with app.app_context():
        _migrate_schema(app)
        db.create_all()
        if app.config["SEED_DEFAULT_CATEGORIES"]:
            seed_default_categories()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
