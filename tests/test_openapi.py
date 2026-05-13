import importlib
import os
import sys
from pathlib import Path

os.environ.setdefault(
    "SUPABASE_DB_URL",
    "postgresql://postgres:postgres@localhost:5432/postgres",
)
os.environ.setdefault("APP_ENV", "development")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

main = importlib.reload(importlib.import_module("analytics.main"))
main.init_connection_pool = lambda: None
main.check_database_connection = lambda: None


def test_openapi_schema_lists_public_routes() -> None:
    schema = main.app.openapi()

    assert "/health" in schema["paths"]
    assert "/telemetry/sample" in schema["paths"]
