from flask import Blueprint, jsonify

from ...services.dashboard import build_dashboard

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.get("")
def dashboard():
    return jsonify(build_dashboard())