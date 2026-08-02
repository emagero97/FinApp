# Entry point for building the Flask backend into a standalone executable
# (PyInstaller) so a packaged Electron app needs no Python installed.
#
# NOTE: this path logic matters at BUILD time — PyInstaller resolves
# "from backend.app import app" relative to these entries, so we must make the
# repository root importable no matter which folder PyInstaller is run from.
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
for entry in (SCRIPT_DIR, REPO_ROOT):
    if entry not in sys.path:
        sys.path.insert(0, entry)

from backend.app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(debug=False, port=port, threaded=True)
