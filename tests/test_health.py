import os
import sys
from pathlib import Path

os.environ.setdefault(
    "SUPABASE_DB_URL",
    "postgresql://postgres:postgres@localhost:5432/postgres",
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from analytics import main


main.init_connection_pool = lambda: None
main.check_database_connection = lambda: None

def test_health_endpoint_reports_ok() -> None:
    response = main.health()

    assert response["status"] == "ok"
