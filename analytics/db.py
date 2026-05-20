from contextlib import contextmanager
from typing import Iterator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.sql import Identifier, SQL
from psycopg_pool import ConnectionPool

from analytics.config import settings

_connection_pool: ConnectionPool | None = None


def _clean_conninfo(url: str) -> str:
    """Remove query parameters that psycopg does not understand (e.g. pgbouncer)."""
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    params.pop("pgbouncer", None)
    clean_query = urlencode(params, doseq=True)
    return urlunparse(parsed._replace(query=clean_query))


def init_connection_pool() -> None:
    global _connection_pool

    if _connection_pool is None:
        _connection_pool = ConnectionPool(
            conninfo=_clean_conninfo(settings.supabase_db_url),
            kwargs={"row_factory": dict_row},
            open=False,
        )

    if _connection_pool.closed:
        _connection_pool.open()


def close_connection_pool() -> None:
    if _connection_pool is not None and not _connection_pool.closed:
        _connection_pool.close()


@contextmanager
def get_connection() -> Iterator[Connection]:
    if _connection_pool is None or _connection_pool.closed:
        init_connection_pool()

    assert _connection_pool is not None

    with _connection_pool.connection() as conn:
        yield conn


def fetch_telemetry_sample(limit: int) -> list[dict]:
    query = SQL(
        """
        SELECT *
        FROM {}
        ORDER BY timestamp DESC
        LIMIT %s
        """
    ).format(Identifier(settings.telemetry_table))

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()

    return [dict(row) for row in rows]


def check_database_connection() -> None:
    query = SQL("SELECT 1 FROM {} LIMIT 1").format(
        Identifier(settings.telemetry_table)
    )

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            cur.fetchone()
