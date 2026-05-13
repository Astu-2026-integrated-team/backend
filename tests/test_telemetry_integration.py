import importlib
import os
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("CI_POSTGRES_INTEGRATION") != "1",
    reason="requires CI Postgres integration environment",
)

os.environ.setdefault("APP_ENV", "development")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def load_app():
    os.environ.setdefault(
        "SUPABASE_DB_URL",
        "postgresql://postgres:postgres@localhost:5432/postgres",
    )
    return importlib.reload(importlib.import_module("analytics.main"))


def test_telemetry_sample_returns_seeded_rows() -> None:
    main = load_app()
    main.startup_checks()

    try:
        body = main.telemetry_sample(1)
    finally:
        main.shutdown_cleanup()

    assert body["table"] == os.environ.get("TELEMETRY_TABLE", "telemetry_normalized")
    assert body["count"] >= 1
    assert len(body["rows"]) >= 1
