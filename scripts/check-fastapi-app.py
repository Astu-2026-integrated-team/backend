from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> None:
    os.environ.setdefault(
        "SUPABASE_DB_URL",
        "postgresql://postgres:postgres@localhost:5432/postgres",
    )
    os.environ.setdefault("APP_ENV", "development")

    from analytics.main import app

    paths = sorted(route.path for route in app.routes)
    required_paths = ["/health", "/openapi.json", "/telemetry/sample"]

    missing = [path for path in required_paths if path not in paths]
    if missing:
        raise SystemExit(f"FastAPI app is missing expected routes: {missing}")

    print("FastAPI app imports successfully.")
    print(f"Registered routes: {paths}")


if __name__ == "__main__":
    main()
