from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def normalize_paths(paths: dict[str, object]) -> dict[str, dict[str, list[str]]]:
    normalized: dict[str, dict[str, list[str]]] = {}
    for path, operations in paths.items():
        normalized[path] = {}
        for method, operation in operations.items():
            responses = operation.get("responses", {})
            normalized[path][method] = sorted(str(status) for status in responses.keys())
    return normalized


def main() -> None:
    spec_path = Path("openapi/fastapi.json")
    spec = json.loads(spec_path.read_text(encoding="utf-8"))

    if "openapi" not in spec or "paths" not in spec:
        raise SystemExit("openapi/fastapi.json is not a valid OpenAPI document.")

    os.environ.setdefault(
        "SUPABASE_DB_URL",
        "postgresql://postgres:postgres@localhost:5432/postgres",
    )
    os.environ.setdefault("APP_ENV", "development")

    from analytics.main import app

    runtime_schema = app.openapi()
    expected = normalize_paths(spec["paths"])
    runtime = normalize_paths(runtime_schema["paths"])

    if expected != runtime:
        raise SystemExit(
            "FastAPI OpenAPI contract mismatch.\n"
            f"Expected: {json.dumps(expected, indent=2, sort_keys=True)}\n"
            f"Runtime: {json.dumps(runtime, indent=2, sort_keys=True)}"
        )

    print("FastAPI OpenAPI contract matches runtime routes.")


if __name__ == "__main__":
    main()
