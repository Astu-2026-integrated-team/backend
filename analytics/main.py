import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from psycopg import Error as PsycopgError

from analytics.config import settings
from analytics.db import (
    check_database_connection,
    close_connection_pool,
    fetch_telemetry_sample,
    init_connection_pool,
)

logger = logging.getLogger(__name__)
db_startup_check_passed = True


def startup_checks() -> None:
    global db_startup_check_passed
    init_connection_pool()
    try:
        check_database_connection()
    except PsycopgError:
        db_startup_check_passed = False
        logger.exception("Startup database connection check failed")


def shutdown_cleanup() -> None:
    close_connection_pool()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    startup_checks()
    try:
        yield
    finally:
        shutdown_cleanup()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    summary="Fuel-Aware backend APIs",
    description=(
        "Operational endpoints for the Fuel-Aware backend across health and telemetry"
        " verification flows."
    ),
    lifespan=lifespan,
)


@app.get(
    "/health",
    summary="Check FastAPI backend health",
    description="Returns the FastAPI runtime state and startup database reachability.",
    tags=["System"],
    responses={
        200: {
            "description": "FastAPI runtime health payload.",
        }
    },
)
def health() -> dict[str, str]:
    database_status = "reachable" if db_startup_check_passed else "unreachable"
    return {
        "status": "ok" if db_startup_check_passed else "degraded",
        "environment": settings.app_env,
        "database": database_status,
    }


if settings.app_env.lower() == "development":
    @app.get(
        "/telemetry/sample",
        summary="Fetch a telemetry sample",
        description=(
            "Returns a limited sample from the telemetry table for development-time"
            " connectivity and payload verification."
        ),
        tags=["Telemetry"],
        responses={
            200: {
                "description": "A telemetry sample payload.",
            },
            500: {
                "description": "The database query failed.",
            },
        },
    )
    def telemetry_sample(limit: int = Query(default=10, ge=1, le=100)) -> dict[str, object]:
        try:
            rows = fetch_telemetry_sample(limit)
        except PsycopgError as exc:
            logger.exception("Telemetry sample query failed")
            raise HTTPException(
                status_code=500,
                detail="Database query failed.",
            ) from exc

        return {
            "table": settings.telemetry_table,
            "count": len(rows),
            "rows": rows,
        }
