-- schema.sql

CREATE TABLE admin_users (
  "adminId" TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "lastLoginAt" TIMESTAMPTZ NULLABLE
);

CREATE TABLE drivers (
  "driverId" TEXT PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL UNIQUE,
  "phoneNumber" TEXT NULLABLE,
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vehicles (
  "vehicleId" TEXT PRIMARY KEY,
  "plateNumber" TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  "tankCapacityLiters" FLOAT NOT NULL,
  make TEXT NULLABLE,
  model TEXT NULLABLE,
  year INTEGER NULLABLE,
  color TEXT NULLABLE,
  "assignedDriverId" TEXT NULLABLE REFERENCES drivers("driverId"),
  "assignedDeviceId" TEXT NULLABLE,
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE devices (
  "deviceId" TEXT PRIMARY KEY,
  "vehicleId" TEXT NULLABLE REFERENCES vehicles("vehicleId"),
  "firmwareVersion" TEXT NULLABLE,
  "lastSeenAt" TIMESTAMPTZ NULLABLE,
  status TEXT NOT NULL DEFAULT 'offline',
  "registeredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "registeredBy" TEXT NOT NULL
);

-- Fix foreign key dependency
ALTER TABLE vehicles ADD CONSTRAINT fk_vehicles_devices FOREIGN KEY ("assignedDeviceId") REFERENCES devices("deviceId");

CREATE TABLE telemetry_raw (
  "telemetryId" TEXT PRIMARY KEY,
  "deviceId" TEXT NOT NULL REFERENCES devices("deviceId"),
  "vehicleId" TEXT NOT NULL REFERENCES vehicles("vehicleId"),
  "receivedAt" TIMESTAMPTZ NOT NULL,
  "rawPayload" JSONB NOT NULL,
  source TEXT NOT NULL
);

CREATE TABLE telemetry_normalized (
  "telemetryId" TEXT PRIMARY KEY REFERENCES telemetry_raw("telemetryId"),
  "vehicleId" TEXT NOT NULL REFERENCES vehicles("vehicleId"),
  "deviceId" TEXT NOT NULL REFERENCES devices("deviceId"),
  "receivedAt" TIMESTAMPTZ NOT NULL,
  "deviceUptimeMs" INTEGER NOT NULL,
  "fuelLiters" FLOAT NOT NULL,
  "fuelPercent" INTEGER NOT NULL,
  "engineOn" BOOLEAN NOT NULL,
  "doorOpen" BOOLEAN NOT NULL,
  "tempCelsius" FLOAT NOT NULL,
  "accelG" FLOAT NOT NULL,
  "speedKmh" FLOAT NOT NULL,
  "fuelRateLhr" FLOAT NOT NULL,
  "tripSeconds" INTEGER NOT NULL,
  "tripFuelUsed" FLOAT NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  "locationName" TEXT NULLABLE,
  "geofenceOk" BOOLEAN NOT NULL,
  "lowFuelFlag" BOOLEAN NOT NULL,
  "parkingMode" BOOLEAN NOT NULL,
  "overspeedFlag" BOOLEAN NOT NULL,
  "deviceAlertText" TEXT NULLABLE
);

CREATE TABLE trips (
  "tripId" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL REFERENCES vehicles("vehicleId"),
  "driverId" TEXT NULLABLE REFERENCES drivers("driverId"),
  "startTime" TIMESTAMPTZ NOT NULL,
  "endTime" TIMESTAMPTZ NULLABLE,
  "startFuelLiters" FLOAT NOT NULL,
  "endFuelLiters" FLOAT NULLABLE,
  "fuelUsedLiters" FLOAT NULLABLE,
  "distanceKm" FLOAT NULLABLE,
  "avgSpeedKmh" FLOAT NULLABLE,
  "maxSpeedKmh" FLOAT NULLABLE,
  "startLat" FLOAT NOT NULL,
  "startLon" FLOAT NOT NULL,
  "endLat" FLOAT NULLABLE,
  "endLon" FLOAT NULLABLE,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE vehicle_latest_state (
  "vehicleId" TEXT PRIMARY KEY REFERENCES vehicles("vehicleId"),
  "lastSeenAt" TIMESTAMPTZ NOT NULL,
  "fuelLiters" FLOAT NOT NULL,
  "fuelPercent" INTEGER NOT NULL,
  "engineOn" BOOLEAN NOT NULL,
  "doorOpen" BOOLEAN NOT NULL,
  "tempCelsius" FLOAT NOT NULL,
  "speedKmh" FLOAT NOT NULL,
  "accelG" FLOAT NOT NULL,
  "fuelRateLhr" FLOAT NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  "locationName" TEXT NULLABLE,
  "geofenceOk" BOOLEAN NOT NULL,
  "parkingMode" BOOLEAN NOT NULL,
  "overspeedFlag" BOOLEAN NOT NULL,
  "deviceStatus" TEXT NOT NULL,
  "currentAlertLevel" TEXT NOT NULL DEFAULT 'none',
  "activeTripId" TEXT NULLABLE REFERENCES trips("tripId")
);

CREATE TABLE alerts (
  "alertId" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL REFERENCES vehicles("vehicleId"),
  "driverId" TEXT NULLABLE REFERENCES drivers("driverId"),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  message TEXT NOT NULL,
  evidence JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "resolvedAt" TIMESTAMPTZ NULLABLE
);

CREATE TABLE driver_violations (
  "violationId" TEXT PRIMARY KEY,
  "driverId" TEXT NOT NULL REFERENCES drivers("driverId"),
  "vehicleId" TEXT NOT NULL REFERENCES vehicles("vehicleId"),
  "alertId" TEXT NOT NULL REFERENCES alerts("alertId"),
  "tripId" TEXT NULLABLE REFERENCES trips("tripId"),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ NOT NULL
);

-- CREATE INDEX statements
CREATE INDEX idx_telemetry_normalized_vehicle_time ON telemetry_normalized("vehicleId", "receivedAt");
CREATE INDEX idx_alerts_vehicle_status ON alerts("vehicleId", status);
CREATE INDEX idx_trips_vehicle_status ON trips("vehicleId", status);
