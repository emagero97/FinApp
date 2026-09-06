from flask import Blueprint, jsonify, request

from ...schemas import parse_json_body
from ...schemas.transaction import parse_transaction_payload, serialize_transaction
from ...services import transaction_service
from ...services.errors import ServiceError

bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")


@bp.errorhandler(ServiceError)
def _handle_service_error(exc):
    return jsonify(exc.payload), exc.status


@bp.get("")
def list_transactions():
    rows = transaction_service.list_transactions(request.args)
    return jsonify(
        {
            "transactions": [serialize_transaction(tx, cat) for tx, cat in rows],
            "total": len(rows),
        }
    )


@bp.get("/<int:transaction_id>")
def get_transaction(transaction_id: int):
    transaction = transaction_service.get_transaction(transaction_id)
    return jsonify(serialize_transaction(transaction))


@bp.post("")
def create_transaction():
    try:
        data = parse_json_body(request)
    except ValueError as exc:
        return jsonify({"errors": {"body": str(exc)}}), 400

    fields, errors = parse_transaction_payload(data)
    if errors:
        return jsonify({"errors": errors}), 400

    transaction = transaction_service.create_transaction(fields)
    return jsonify(serialize_transaction(transaction)), 201


@bp.put("/<int:transaction_id>")
def update_transaction(transaction_id: int):
    transaction = transaction_service.get_transaction(transaction_id)

    try:
        data = parse_json_body(request)
    except ValueError as exc:
        return jsonify({"errors": {"body": str(exc)}}), 400

    fields, errors = parse_transaction_payload(data, current=transaction)
    if errors:
        return jsonify({"errors": errors}), 400

    transaction = transaction_service.update_transaction(transaction, fields)
    return jsonify(serialize_transaction(transaction))


@bp.delete("/<int:transaction_id>")
def delete_transaction(transaction_id: int):
    transaction = transaction_service.get_transaction(transaction_id)
    transaction_service.delete_transaction(transaction)
    return "", 204