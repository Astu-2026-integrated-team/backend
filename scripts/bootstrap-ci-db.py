from __future__ import annotations

import os

from psycopg import connect


def main() -> None:
    db_url = os.environ["SUPABASE_DB_URL"]
    telemetry_table = os.environ.get("TELEMETRY_TABLE", "telemetry_normalized")

    create_table_sql = f"""
    CREATE TABLE IF NOT EXISTS {telemetry_table} (
        "telemetryId" uuid PRIMARY KEY,
        "vehicleId" uuid NOT NULL,
        "deviceId" text NOT NULL,
        timestamp timestamptz NOT NULL,
        "fuelLevelLiters" numeric(10, 2),
        "fuelLevelPercent" numeric(5, 2),
        latitude numeric(10, 7),
        longitude numeric(10, 7),
        "speedKph" numeric(10, 2),
        "engineStatus" text
    );
    """

    seed_sql = f"""
    INSERT INTO {telemetry_table} (
        "telemetryId",
        "vehicleId",
        "deviceId",
        timestamp,
        "fuelLevelLiters",
        "fuelLevelPercent",
        latitude,
        longitude,
        "speedKph",
        "engineStatus"
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'device-001',
        NOW(),
        45.50,
        71.00,
        9.0101000,
        38.7610000,
        52.00,
        'on'
    )
    ON CONFLICT ("telemetryId") DO NOTHING;
    """

    with connect(db_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(create_table_sql)
            cur.execute(seed_sql)

    print(f"CI database bootstrap completed for table {telemetry_table}.")


if __name__ == "__main__":
    main()
