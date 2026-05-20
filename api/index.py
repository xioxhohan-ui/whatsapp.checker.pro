import os
import sys

# Add the 'backend' folder to the python path so that 'app' module can be loaded correctly
backend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Enable SQLite fallback by default in serverless mode if no custom database is set
if "USE_SQLITE" not in os.environ and "DATABASE_URL" not in os.environ:
    os.environ["USE_SQLITE"] = "1"

# Import the FastAPI instance
from app.main import app
