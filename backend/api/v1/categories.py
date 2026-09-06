from flask import Blueprint, jsonify, request

from ...schemas import parse_json_body
from ...schemas.category import parse_category_payload, serialize_category
from ...services import category_service
from ...services.errors import ServiceError

bp = Blueprint("categories", __name__, url_prefix="/api/categories")


@bp.errorhandler(ServiceError)
def _handle_service_error(exc):
    return jsonify(exc.payload), exc.status


@bp.get("")
def list_categories():
    categories, stats = category_service.list_categories(request.args)
    return jsonify(
        {"categories": [serialize_category(c, stats.get(c.id)) for c in categories], "total": len(categories)}
    )


@bp.get("/<int:category_id>")
def get_category(category_id: int):
    category = category_service.get_category(category_id)
    stats = category_service.stats_for([category.id]).get(category.id)
    return jsonify(serialize_category(category, stats))


@bp.post("")
def create_category():
    try:
        data = parse_json_body(request)
    except ValueError as exc:
        return jsonify({"errors": {"body": str(exc)}}), 400

    fields, errors = parse_category_payload(data)
    if errors:
        return jsonify({"errors": errors}), 400

    category = category_service.create_category(fields)
    return jsonify(serialize_category(category)), 201


@bp.put("/<int:category_id>")
def update_category(category_id: int):
    category = category_service.get_category(category_id)

    try:
        data = parse_json_body(request)
    except ValueError as exc:
        return jsonify({"errors": {"body": str(exc)}}), 400

    fields, errors = parse_category_payload(data, current=category)
    if errors:
        return jsonify({"errors": errors}), 400

    category = category_service.update_category(category, fields)
    stats = category_service.stats_for([category.id]).get(category.id)
    return jsonify(serialize_category(category, stats))


@bp.delete("/<int:category_id>")
def delete_category(category_id: int):
    category = category_service.get_category(category_id)
    category_service.delete_category(category)
    return "", 204