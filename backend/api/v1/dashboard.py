from flask import Blueprint, jsonify, request

from ...services.dashboard import build_dashboard
from ...services.errors import ServiceError

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.errorhandler(ServiceError)
def _handle_service_error(exc):
    return jsonify(exc.payload), exc.status


@bp.get("")
def dashboard():
    return jsonify(build_dashboard(request.args.get("month"), request.args.get("scope", "month")))