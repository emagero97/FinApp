def parse_json_body(request) -> dict:
    """Parse the body of a request into a plain dict, raising ValueError if it is not JSON."""
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object")
    return data