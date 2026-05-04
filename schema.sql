create extension if not exists "pgcrypto";

create table if not exists public.vehicles (
  "vehicleId" uuid primary key default gen_random_uuid(),
  "plateNumber" text not null,
  label text not null,
  "tankCapacityLiters" numeric(10, 2) not null,
  "assignedDriver" text,
  status text not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.telemetry_raw (
  "telemetryId" uuid primary key default gen_random_uuid(),
  "receivedAt" timestamptz not null default now(),
  payload jsonb not null,
  source text not null
);

create table if not exists public.telemetry_normalized (
  "telemetryId" uuid primary key default gen_random_uuid(),
  "vehicleId" uuid not null references public.vehicles("vehicleId") on delete cascade,
  "deviceId" text not null,
  "timestamp" timestamptz not null,
  "fuelLevelLiters" numeric(10, 2),
  "fuelLevelPercent" numeric(5, 2),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  "speedKph" numeric(10, 2),
  "engineStatus" text
);

create table if not exists public.vehicle_latest_state (
  "vehicleId" uuid primary key references public.vehicles("vehicleId") on delete cascade,
  "lastSeenAt" timestamptz,
  "fuelLevelLiters" numeric(10, 2),
  "fuelLevelPercent" numeric(5, 2),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  "engineStatus" text,
  "deviceStatus" text,
  "currentAlertLevel" text
);