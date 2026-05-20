# Skill: naming-conventions
# Scope: FuelGuard AI Backend (TypeScript + Express + Supabase)
# Used by: Antigravity AI coding agent
# Reference doc: docs/FuelGuard_Backend_Spec.md

---

## PURPOSE

Enforce consistent, unambiguous naming across every layer of the FuelGuard backend —
files, folders, variables, functions, DB columns, routes, constants, env vars, and tests.
Before writing or modifying ANY identifier, consult this skill.
If a proposed name conflicts with an existing pattern, STOP and prompt the developer with options.

---

## 1. FILE & FOLDER NAMING

### Rule: kebab-case for all files and folders

✅ Correct
  src/routes/auth.ts
  src/routes/telemetry.ts
  src/services/alert-rule-engine.ts
  src/services/telemetry-service.ts
  src/services/trip-service.ts
  src/services/websocket-service.ts
  src/services/stale-check-job.ts
  src/middleware/auth-middleware.ts
  src/middleware/device-auth-middleware.ts
  src/db/supabase-client.ts
  src/websocket/ws-server.ts
  src/config/thresholds.ts
  tests/unit/alert-rule-engine.test.ts
  tests/integration/telemetry.test.ts
  tests/smoke/api-smoke.test.ts

❌ Wrong
  alertRuleEngine.ts         (camelCase — NOT for filenames)
  AlertRuleEngine.ts         (PascalCase — NOT for filenames)
  alert_rule_engine.ts       (snake_case — NOT for JS files)
  TELEMETRY_SERVICE.ts       (SCREAMING — NOT for filenames)

### Rule: test files mirror source path with .test.ts suffix
  src/services/trip-service.ts  →  tests/unit/trip-service.test.ts
  src/routes/vehicles.ts        →  tests/integration/vehicles.test.ts

### Rule: schema and seed files use snake_case with numeric prefix for ordering
  src/db/001_schema.sql
  src/db/002_seed_admin.sql
  src/db/003_seed_vehicles.sql

---

## 2. TypeScript IDENTIFIERS

### Variables and parameters: camelCase
  const telemetryId = uuid();
  const vehicleId = req.params.vehicleId;
  const fuelLiters = payload.fuel_l;
  const receivedAt = new Date().toISOString();

### Functions: camelCase, verb-first
  async function ingestTelemetry(payload, deviceId) {}
  async function broadcastToAll(message) {}
  async function detectTripTransition(vehicleId, incoming) {}
  async function runAlertRules(normalized, previous) {}
  async function closeTripOnEngineOff(vehicleId, telemetry) {}
  async function openTripOnEngineOn(vehicleId, telemetry) {}
  function mapRawToNormalized(raw, deviceId, vehicleId) {}

✅ Verb-first function naming reference
  get*, fetch*, load*   → read operations    (getVehicle, fetchLatestState)
  insert*, create*      → write new records  (insertTelemetryRaw, createAlert)
  update*, upsert*      → write existing     (upsertVehicleState, updateDeviceStatus)
  delete*, remove*      → deletions          (removeDriver)
  run*, check*, detect* → logic / evaluation (runAlertRules, checkDeviceStale)
  broadcast*            → WebSocket send     (broadcastVehicleUpdate, broadcastAlertFired)
  validate*             → input validation   (validateTelemetryPayload)
  map*, normalize*      → data transform     (mapRawToNormalized)

❌ Wrong
  function doTelemetry() {}         (vague verb)
  function telemetryHandler() {}    (handler suffix is for route callbacks only)
  function TripOpen() {}            (PascalCase — NOT for functions)

### Route handler callbacks: camelCase with Handler suffix
  async function loginHandler(req, res) {}
  async function ingestTelemetryHandler(req, res) {}
  async function listVehiclesHandler(req, res) {}
  async function getVehicleHandler(req, res) {}
  async function listTripsHandler(req, res) {}
  async function listAlertsHandler(req, res) {}
  async function acknowledgeAlertHandler(req, res) {}
  async function registerVehicleHandler(req, res) {}
  async function registerDeviceHandler(req, res) {}
  async function reassignDeviceHandler(req, res) {}
  async function registerDriverHandler(req, res) {}
  async function getDriverViolationsHandler(req, res) {}

### Classes: PascalCase (use sparingly — prefer functions/modules)
  class WebSocketServer {}
  class AlertRuleEngine {}

### Constants (module-level, never change): SCREAMING_SNAKE_CASE
  const ALERT_TYPES = { LOW_FUEL: 'LOW_FUEL', OVERSPEED: 'OVERSPEED', ... };
  const SEVERITY = { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' };
  const DEVICE_STATUS = { ONLINE: 'online', STALE: 'stale', OFFLINE: 'offline' };
  const WS_EVENTS = {
    CONNECTED:            'CONNECTED',
    ALL_VEHICLES_STATE:   'ALL_VEHICLES_STATE',
    VEHICLE_UPDATE:       'VEHICLE_UPDATE',
    ALERT_FIRED:          'ALERT_FIRED',
    DEVICE_STATUS_CHANGE: 'DEVICE_STATUS_CHANGE',
  };

### Boolean variables: is/has/can prefix
  const isEngineOn = normalized.engineOn;
  const hasPreviousState = !!latestState;
  const isDoorOpenParked = doorOpen && !engineOn && parkingMode;
  const isOverspeed = speedKmh > thresholds.OVERSPEED_KMH;

---

## 3. DATABASE NAMING

### Tables: snake_case, plural
  vehicles
  devices
  drivers
  telemetry_raw
  telemetry_normalized
  vehicle_latest_state
  alerts
  trips
  driver_violations
  admin_users

### Columns: camelCase in DB (Supabase convention maintained from spec)
  vehicleId, plateNumber, tankCapacityLiters, assignedDriverId
  deviceId, firmwareVersion, lastSeenAt
  telemetryId, rawPayload, receivedAt, schemaVersion
  fuelLiters, fuelPercent, engineOn, doorOpen, tempCelsius
  accelG, speedKmh, fuelRateLhr, tripSeconds, tripFuelUsed
  locationName, geofenceOk, lowFuelFlag, parkingMode, overspeedFlag
  deviceAlertText, currentAlertLevel, activeTripId
  startFuelLiters, endFuelLiters, fuelUsedLiters, distanceKm
  avgSpeedKmh, maxSpeedKmh, startLat, startLon, endLat, endLon
  violationId, driverId, alertId, tripId, occurredAt
  adminId, passwordHash, lastLoginAt

### Primary keys: always {entityName}Id
  vehicleId, deviceId, driverId, tripId, alertId, violationId, telemetryId, adminId

### Foreign keys: same name as the PK they reference
  vehicleId references vehicles.vehicleId
  driverId references drivers.driverId
  alertId references alerts.alertId

### Enum-like TEXT columns: always document allowed values in schema.sql comment
  -- status: 'active' | 'inactive' | 'maintenance'
  -- deviceStatus: 'online' | 'stale' | 'offline'
  -- severity: 'info' | 'warning' | 'critical'
  -- alertStatus: 'open' | 'acknowledged' | 'resolved'
  -- tripStatus: 'active' | 'completed'

---

## 4. API ROUTE NAMING

### Pattern: /api/{resource}/{id?}/{sub-resource?}
### Always lowercase, hyphen-separated multi-word resources

  POST   /api/auth/login
  POST   /api/telemetry
  GET    /api/vehicles
  POST   /api/vehicles
  GET    /api/vehicles/:vehicleId
  PATCH  /api/vehicles/:vehicleId
  GET    /api/vehicles/:vehicleId/history
  GET    /api/vehicles/:vehicleId/trips
  GET    /api/vehicles/:vehicleId/alerts
  GET    /api/devices
  POST   /api/devices
  PATCH  /api/devices/:deviceId
  GET    /api/drivers
  POST   /api/drivers
  PATCH  /api/drivers/:driverId
  GET    /api/drivers/:driverId/violations
  GET    /api/alerts
  PATCH  /api/alerts/:alertId

### URL parameter names: camelCase matching the DB primary key
  :vehicleId, :deviceId, :driverId, :alertId, :tripId

### Query parameter names: camelCase
  ?from=, ?to=, ?limit=, ?offset=, ?status=, ?severity=, ?fields=, ?deviceStatus=, ?type=

---

## 5. ENVIRONMENT VARIABLE NAMING

### Pattern: SCREAMING_SNAKE_CASE, grouped by concern
  # Server
  PORT

  # Supabase
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

  # Auth
  JWT_SECRET
  JWT_EXPIRES_IN
  ADMIN_USERNAME
  ADMIN_PASSWORD

  # Hardware
  DEVICE_TOKEN

  # Thresholds (all numeric, read by src/config/thresholds.ts)
  STALE_THRESHOLD_MINUTES
  OFFLINE_THRESHOLD_MINUTES
  THEFT_DROP_LITERS
  THEFT_WINDOW_MINUTES
  LOW_FUEL_PERCENT
  REFILL_MIN_LITERS
  OVERSPEED_KMH

### Rule: NEVER hardcode a threshold value inline — always read from thresholds.ts
  ✅  if (fuelPct < thresholds.LOW_FUEL_PERCENT)
  ❌  if (fuelPct < 15)

---

## 6. ERROR CODE NAMING

### Pattern: SCREAMING_SNAKE_CASE, noun-first, describes WHAT is wrong
  INVALID_PAYLOAD
  INVALID_CREDENTIALS
  INVALID_TOKEN
  MISSING_TOKEN
  UNKNOWN_DEVICE
  NOT_FOUND
  FORBIDDEN
  DUPLICATE_VEHICLE_ID
  DUPLICATE_DEVICE_ID
  DUPLICATE_LICENSE
  VALIDATION_ERROR
  INTERNAL_ERROR

---

## 7. WEBSOCKET EVENT TYPE NAMING

### Pattern: SCREAMING_SNAKE_CASE, noun-verb or noun-state
  CONNECTED
  ALL_VEHICLES_STATE
  VEHICLE_UPDATE
  ALERT_FIRED
  DEVICE_STATUS_CHANGE

### Rule: all WS event types must be defined in WS_EVENTS constant
### Rule: never use a raw string for a WS event type — always reference WS_EVENTS.*

---

## 8. TEST NAMING

### describe() blocks: match the module/function being tested
  describe('alertRuleEngine', () => {})
  describe('tripService → openTripOnEngineOn', () => {})
  describe('POST /api/telemetry', () => {})

### it() / test() blocks: "should {behavior} when {condition}"
  it('should insert LOW_FUEL alert when fuelPercent is below threshold', ...)
  it('should not duplicate LOW_FUEL alert when one is already open', ...)
  it('should return 401 when device token is missing', ...)
  it('should broadcast VEHICLE_UPDATE after valid telemetry is stored', ...)
  it('should close active trip when engineOn transitions to false', ...)

---

## 9. CONFLICT DETECTION

Before finalizing ANY new name, Antigravity MUST check:

1. Does a variable/function with this name already exist in the same scope?
2. Does a DB column with this name already exist in the target table?
3. Does an API route with this path already exist in routes/?
4. Does a WS event type with this name already exist in WS_EVENTS?
5. Does an error code with this value already exist in the error catalog?

If ANY conflict is found → STOP, do not proceed, present the conflict and options to the developer.

---

## 10. ANTI-PATTERNS (never do these)

❌  Single-letter variables except loop counters (i, j, k)
❌  Abbreviations that aren't in the spec (use fuelLiters not fl, use vehicleId not vid)
❌  Hungarian notation (strName, intCount, boolFlag)
❌  Numbered suffixes to resolve conflicts (vehicle2, newDriver, tempAlert)
     → instead: rename to be semantically precise
❌  Generic names: data, result, response, info, obj, temp, value
     → instead: telemetryPayload, insertResult, loginResponse, vehicleInfo
❌  Mixing conventions in the same file (camelCase function next to snake_case function)
