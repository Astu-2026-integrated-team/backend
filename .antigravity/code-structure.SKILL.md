# Skill: code-structure
# Scope: FuelGuard AI Backend (TypeScript + Express + Supabase)
# Used by: Antigravity AI coding agent
# Reference doc: docs/FuelGuard_Backend_Spec.md

---

## PURPOSE

Enforce strict module boundaries, folder layout, separation of concerns, and dependency rules
across the FuelGuard backend. Antigravity must check these rules before creating any new file,
adding any import, or placing logic in any layer. Violations cause silent coupling debt that
compounds across PRs — prevent them at authoring time.

---

## 1. CANONICAL FOLDER STRUCTURE

backend/
  src/
    routes/           # Express route definitions ONLY — no business logic
      auth.ts
      telemetry.ts
      vehicles.ts
      devices.ts
      drivers.ts
      alerts.ts

    services/         # All business logic — called by routes, never by each other directly
      telemetry-service.ts     # ingestion pipeline (steps 1-13 from spec §5.2)
      alert-rule-engine.ts     # all 7 alert rules (§7)
      trip-service.ts          # trip open/update/close (§6)
      websocket-service.ts     # broadcast helpers (broadcastToAll, etc.)
      stale-check-job.ts       # background cron — device stale/offline detection (§7.7)

    middleware/        # Express middleware functions
      auth-middleware.ts         # JWT verification for admin routes
      device-auth-middleware.ts  # X-Device-Token verification for /api/telemetry

    db/                # Database access — raw queries only, no business logic
      supabase-client.ts         # Supabase client singleton
      schema.sql                 # All CREATE TABLE statements
      001_schema.sql             # Migration files if using numbered migrations
      002_seed_admin.sql

    websocket/         # WebSocket server wiring
      ws-server.ts               # Server setup, client Map, upgrade handler

    config/            # Configuration — reads from .env, exports plain objects
      thresholds.ts              # All numeric thresholds from env vars

    app.ts             # Express app setup, mounts routes and middleware
    server.ts          # HTTP server startup, attaches WebSocket server

  tests/
    unit/              # Pure function tests — no DB, no network
    integration/       # Tests that hit real DB (test Supabase instance)
    smoke/             # Tests that hit the running API over HTTP
    helpers/           # Shared test utilities (factories, mocks, fixtures)

  .env.example
  package.json
  swagger.yaml         # OpenAPI spec for all endpoints

---

## 2. LAYER RULES & DEPENDENCY DIRECTION

Layer dependency is strictly ONE-WAY:

  routes → services → db
                   ↘ config
  middleware → db
  middleware → config
  websocket → (imported by services, NOT by routes)

### What each layer MAY and MAY NOT do:

#### routes/ — MAY:
  - Parse req.params, req.query, req.body
  - Call exactly ONE service function per route handler
  - Call res.tson() / res.status()
  - Import from: services/, middleware/
  - Use: zod schemas defined alongside the route for input validation

#### routes/ — MAY NOT:
  - Query the database directly
  - Contain if/else business logic (e.g. alert dedup, threshold checks)
  - Import from: db/ directly
  - Call broadcastToAll or any WebSocket function directly
  - Call another route file

#### services/ — MAY:
  - Contain all business logic
  - Import from: db/supabase-client.ts, config/thresholds.ts, websocket/ws-server.ts
  - Call other service functions IF the dependency is clearly one-directional:
      telemetry-service.ts → alert-rule-engine.ts  ✅  (telemetry calls rules)
      telemetry-service.ts → trip-service.ts        ✅  (telemetry calls trip detection)
      alert-rule-engine.ts → websocket-service.ts   ✅  (rules call broadcast)
  - Import constants from src/config/thresholds.ts

#### services/ — MAY NOT:
  - Import from routes/
  - Import from middleware/
  - Create circular dependencies (A imports B, B imports A)
  - Hardcode any threshold value — always use thresholds.ts

#### db/ — MAY:
  - Export the Supabase client singleton
  - Export raw query helper functions if reused across services
  - Contain schema.sql and seed files

#### db/ — MAY NOT:
  - Contain business logic
  - Import from services/ or routes/

#### middleware/ — MAY:
  - Read JWT from headers, verify, attach req.admin
  - Read X-Device-Token from headers, verify against DEVICE_TOKEN env var
  - Call next() or return error response

#### middleware/ — MAY NOT:
  - Import from services/
  - Contain route-level logic

#### config/thresholds.ts — MAY:
  - Read process.env values
  - Export a frozen plain object of thresholds

#### config/thresholds.ts — MAY NOT:
  - Import anything else
  - Contain logic beyond env-var reading and numeric parsing

---

## 3. MODULE STRUCTURE TEMPLATES

### Route file template (src/routes/vehicles.ts)
```js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth-middleware');
const {
  listVehicles,
  getVehicle,
  registerVehicle,
  updateVehicle,
} = require('../services/vehicle-service');
// Zod schema (defined in this file, not imported from services)
const { z } = require('zod');
const registerVehicleSchema = z.object({ ... });

router.get('/',         authMiddleware, listVehiclesHandler);
router.post('/',        authMiddleware, registerVehicleHandler);
router.get('/:vehicleId',  authMiddleware, getVehicleHandler);
router.patch('/:vehicleId', authMiddleware, updateVehicleHandler);

async function listVehiclesHandler(req, res) {
  try {
    const { status, deviceStatus } = req.query;
    const result = await listVehicles({ status, deviceStatus });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
}
// ... other handlers
module.exports = router;
```

### Service file template (src/services/trip-service.ts)
```js
const { supabase } = require('../db/supabase-client');
const thresholds = require('../config/thresholds');
const { broadcastVehicleUpdate } = require('./websocket-service');

async function openTripOnEngineOn(vehicleId, telemetry, driverId) { ... }
async function updateTripInProgress(vehicleId, tripId, telemetry) { ... }
async function closeTripOnEngineOff(vehicleId, tripId, telemetry) { ... }
async function detectTripTransition(vehicleId, incoming, previousState) { ... }

module.exports = { openTripOnEngineOn, updateTripInProgress, closeTripOnEngineOff, detectTripTransition };
```

### Config file template (src/config/thresholds.ts)
```js
const thresholds = Object.freeze({
  STALE_THRESHOLD_MINUTES:   parseInt(process.env.STALE_THRESHOLD_MINUTES  || '5', 10),
  OFFLINE_THRESHOLD_MINUTES: parseInt(process.env.OFFLINE_THRESHOLD_MINUTES || '15', 10),
  THEFT_DROP_LITERS:         parseFloat(process.env.THEFT_DROP_LITERS       || '4.0'),
  THEFT_WINDOW_MINUTES:      parseInt(process.env.THEFT_WINDOW_MINUTES      || '5', 10),
  LOW_FUEL_PERCENT:          parseInt(process.env.LOW_FUEL_PERCENT           || '15', 10),
  REFILL_MIN_LITERS:         parseFloat(process.env.REFILL_MIN_LITERS        || '5.0'),
  OVERSPEED_KMH:             parseFloat(process.env.OVERSPEED_KMH            || '80'),
});
module.exports = thresholds;
```

---

## 4. TELEMETRY INGESTION PIPELINE — CODE PLACEMENT RULES

The 13-step pipeline from spec §5.2 maps to these exact functions and files:

Step  | File                            | Function
------|---------------------------------|------------------------------------------
1     | device-auth-middleware.ts       | deviceAuthMiddleware (verifies X-Device-Token)
2     | telemetry-service.ts            | resolveVehicleFromDevice(deviceId)
3     | routes/telemetry.ts             | zod schema validation inline
4     | telemetry-service.ts            | ingestTelemetry() — generates UUID
5     | telemetry-service.ts            | insertTelemetryRaw(payload)
6     | telemetry-service.ts            | insertTelemetryNormalized(mapped)
7     | telemetry-service.ts            | upsertVehicleLatestState(vehicleId, normalized)
8     | telemetry-service.ts            | updateDeviceStatus(deviceId, 'online')
9     | trip-service.ts                 | detectTripTransition(vehicleId, incoming, prev)
10    | alert-rule-engine.ts            | runAlertRules(normalized, previousState)
11    | websocket-service.ts            | broadcastVehicleUpdate(vehicleId, state)
12    | websocket-service.ts            | broadcastAlertFired(alert) [if new alerts]
13    | routes/telemetry.ts             | res.tson({ accepted: true, ... })

Rule: each step is a named function. No anonymous inline logic in ingestTelemetry() body
beyond calling these named functions in order.

---

## 5. ALERT RULE ENGINE STRUCTURE

Each alert rule is its own named function inside alert-rule-engine.ts:

  checkLowFuel(normalized, vehicleId)         → Alert | null
  checkSuspectedFuelDrop(normalized, vehicleId, recentRecords) → Alert | null
  checkOverspeed(normalized, vehicleId)       → Alert | null
  checkDoorOpenParked(normalized, vehicleId)  → Alert | null
  checkGeofenceViolation(normalized, vehicleId) → Alert | null
  checkRefillDetected(normalized, vehicleId, previousState) → Alert | null

Orchestrator (called by telemetry-service.ts):
  async function runAlertRules(normalized, previousState, vehicleId) → Alert[]

Rules return null (no alert) or an alert object (to be inserted + broadcast).
The orchestrator collects results, filters nulls, inserts, broadcasts.

Rule: no rule function calls Supabase directly — it receives the data it needs as arguments.
The orchestrator handles all DB reads (e.g. open alerts, recent records) and passes them in.
This makes each rule unit-testable with zero DB mocking.

---

## 6. WEBSOCKET SERVER STRUCTURE

src/websocket/ws-server.ts exports:
  - wss: the WebSocket.Server instance
  - clients: Map<ws, { connectedAt, clientId }>
  - function broadcastToAll(message: object): void

src/services/websocket-service.ts exports (wraps ws-server.ts with typed messages):
  - broadcastVehicleUpdate(vehicleId, state)
  - broadcastAlertFired(alert)
  - broadcastDeviceStatusChange(vehicleId, deviceId, prevStatus, newStatus)
  - sendAllVehiclesState(ws, vehicles)  ← only to ONE client, on connect

Rule: routes/ NEVER import from websocket/ or websocket-service.ts directly.
Only services/telemetry-service.ts and services/stale-check-job.ts call broadcast functions.

---

## 7. BACKGROUND JOB STRUCTURE

src/services/stale-check-job.ts:
  - Uses node-cron, runs every 60 seconds
  - Queries devices table for lastSeenAt
  - Calls updateDeviceStatus(deviceId, newStatus) for transitions
  - Calls broadcastDeviceStatusChange(...) on status transition
  - Calls createAlert(DEVICE_STALE / DEVICE_OFFLINE) if no open alert exists
  - Started by server.ts after HTTP server is listening

Rule: stale-check-job.ts is started ONCE in server.ts. Never import and start it elsewhere.

---

## 8. ERROR HANDLING PATTERN

### In route handlers: try/catch, map errors to HTTP codes
```js
async function getVehicleHandler(req, res) {
  try {
    const vehicle = await getVehicle(req.params.vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    return res.status(200).json({ success: true, vehicle });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
}
```

### In services: throw typed errors, never swallow
```js
// Throw with a code property so routes can map it
const err = new Error('Vehicle not found');
err.code = 'NOT_FOUND';
throw err;
```

### In routes: map err.code to HTTP status
```js
const STATUS_MAP = {
  NOT_FOUND:            404,
  DUPLICATE_VEHICLE_ID: 409,
  INVALID_PAYLOAD:      400,
  INVALID_CREDENTIALS:  401,
};
const status = STATUS_MAP[err.code] || 500;
```

Rule: never return a 500 with a stack trace in a production response.
Rule: always log the full error server-side (console.error or logger).

---

## 9. WHAT GOES WHERE — QUICK REFERENCE

Question: "Where does X live?"

Threshold values (numbers)                 → config/thresholds.ts
Supabase queries                           → services/* (call supabase-client.ts)
Input validation schemas (zod)             → alongside the route file that uses them
Business rule logic (alert, trip)          → services/alert-rule-engine.ts, trip-service.ts
WebSocket message formatting               → services/websocket-service.ts
WebSocket client management (Map)          → websocket/ws-server.ts
Express route registration                 → app.ts
HTTP server start + cron start             → server.ts
JWT check                                  → middleware/auth-middleware.ts
Device token check                         → middleware/device-auth-middleware.ts
OpenAPI / Swagger docs                     → swagger.yaml (root of backend/)
DB table definitions                       → src/db/schema.sql
Seed data (admin user)                     → src/db/002_seed_admin.sql
Constants (WS event names, alert types)    → src/config/constants.ts

---

## 10. CONFLICT DETECTION — STRUCTURE RULES

Before creating a new file or placing logic in an existing file, Antigravity MUST verify:

1. Is business logic being placed in a route file? → STOP, move to a service
2. Is a route file importing from db/ directly? → STOP, route via service
3. Is a new service importing from another service creating a cycle?
   → STOP, present the dependency graph and ask the developer to resolve
4. Is a new file being created in the wrong layer?
   → STOP, state which folder it belongs in per this spec and ask to confirm
5. Is threshold logic hardcoded inline rather than reading from thresholds.ts?
   → STOP, replace with thresholds reference before proceeding

---

## 11. ANTI-PATTERNS

❌  God files — one file with 500+ lines doing everything
    → each service file handles ONE domain (trip, alert, telemetry, websocket)

❌  Inline SQL strings scattered across route files
    → all DB access goes through services which call supabase-client.ts

❌  Importing the Supabase client in a route file
    → routes never touch the DB layer

❌  app.ts containing business logic
    → app.ts only mounts routers and middleware

❌  server.ts containing route definitions
    → server.ts only starts the HTTP server and the cron job

❌  Anonymous arrow functions as route handlers that contain >10 lines of logic
    → extract to a named handler function

❌  process.env.SOME_THRESHOLD read at the point of use
    → always read through config/thresholds.ts

❌  Circular service imports
    → if A needs B and B needs A, extract shared logic to a third module
