from flask import Blueprint, jsonify, request

from ...schemas import parse_json_body
from ...services import csv_import_service
from ...services.errors import ServiceError

bp = Blueprint("import", __name__, url_prefix="/api/import")


@bp.errorhandler(ServiceError)
def _handle_service_error(exc):
    return jsonify(exc.payload), exc.status


def parse_body(request) -> tuple[dict | None, tuple | None]:
    try:
        data = parse_json_body(request)
    except ValueError as exc:
        return None, ({"errors": {"body": str(exc)}}, 400)
    content = data.get("content")
    if not isinstance(content, str) or not content.strip():
        return None, ({"errors": {"content": "CSV content is required"}}, 400)
    return data, None


@bp.post("")
def preview():
    data, error = parse_body(request)
    if error:
        return jsonify(error[0]), error[1]
    payload = csv_import_service.preview(data["content"])
    return jsonify(payload)


@bp.post("/commit")
def commit():
    data, error = parse_body(request)
    if error:
        return jsonify(error[0]), error[1]
    create_categories = bool(data.get("create_categories"))
    payload = csv_import_service.commit(data["content"], create_categories)
    return jsonify(payload)