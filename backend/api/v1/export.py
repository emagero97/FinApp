from flask import Blueprint, Response, jsonify, request

from ...schemas.export import to_csv
from ...services import export_service

bp = Blueprint("export", __name__, url_prefix="/api/export")


@bp.get("")
def preview():
    query, errors = export_service.apply_filters(request.args)
    if errors:
        return jsonify({"errors": errors}), 400
    count = query.count()
    return jsonify({"count": count})


@bp.get("/download")
def download():
    query, errors = export_service.apply_filters(request.args)
    if errors:
        return jsonify({"errors": errors}), 400

    rows = query.all()
    if not rows:
        return jsonify({"count": 0, "message": "No transactions match the selected filters."}), 404

    lang = request.args.get("lang", "en")
    first_date = rows[0][0].date
    last_date = rows[-1][0].date
    filename = f"transactions_{first_date.isoformat()}_{last_date.isoformat()}.csv"

    body = "\ufeff" + to_csv(rows, lang)
    response = Response(body, mimetype="text/csv", content_type="text/csv; charset=utf-8")
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    response.headers["X-Total-Count"] = str(len(rows))
    return response