class ServiceError(Exception):
    """Raised by services for expected failures. Carries the HTTP status and body."""

    def __init__(self, status: int = 400, payload: dict | None = None):
        self.status = status
        self.payload = payload if payload is not None else {"error": "Bad request"}
        super().__init__()