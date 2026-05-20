

**FuelGuard AI**

**Smart Inventory System**

Backend Architecture & API Specification

*Version 2.0 — Implementation Ready*

Adama Science and Technology University

ECE \+ CSE \+ SE Integrated Project

# **1\. Hardware Input Contract (Wokwi / ESP32)**

The ESP32 (FuelGuard AI v3.3) emits a JSON payload over HTTP POST every \~6–7 seconds. This is the exact contract the backend must parse. No assumptions are made beyond this output.

## **1.1 Raw Hardware Payload (exact fields from device)**

| {   "t":          4632,          // uptime in milliseconds since boot   "fuel\_l":     2.93,          // fuel level in liters (float)   "fuel\_pct":   4,             // fuel level as percentage (integer 0-100)   "engine":     true,          // engine ON/OFF (boolean)   "door":       true,          // door open/closed (boolean)   "temp\_c":     22.0,          // temperature in Celsius (float)   "accel\_g":    \-2.71,         // acceleration in G-force (float, mid=0G)   "speed\_kmh":  5.9,           // speed in km/h (float)   "rate\_lhr":   0.00,          // fuel consumption rate in L/hr (float)   "trip\_sec":   0,             // seconds elapsed in current trip (integer)   "fuel\_used":  0.00,          // liters used in current trip (float)   "lat":        9.0320,        // GPS latitude (float)   "lon":        38.7469,       // GPS longitude (float)   "location":   "Home",        // named geofence location (string)   "geofence\_ok":true,          // whether vehicle is inside geofence (boolean)   "low\_fuel":   true,          // hardware-side low fuel flag (boolean)   "parking":    false,         // parking mode active (boolean)   "overspeed":  false,         // overspeed flag \>80 km/h (boolean)   "alert":      "Low fuel warning" // device-side alert string (string|null) } |
| :---- |

## **1.2 Hardware Field Reference Table**

| Field | Type | Unit / Values | Required | Notes |
| :---- | :---- | :---- | :---- | :---- |
| t | integer | milliseconds | Yes | Device uptime, NOT wall-clock time |
| fuel\_l | float | liters | Yes | Primary fuel measurement |
| fuel\_pct | integer | 0–100 | Yes | Tank percentage |
| engine | boolean | true/false | Yes | Engine state |
| door | boolean | true/false | Yes | Door open \= true |
| temp\_c | float | °C | Yes | Ambient/engine temperature |
| accel\_g | float | G-force | Yes | Mid-pot \= 0G \= 40 km/h reference |
| speed\_kmh | float | km/h | Yes | Current speed |
| rate\_lhr | float | L/hr | Yes | Real-time consumption rate |
| trip\_sec | integer | seconds | Yes | Seconds in current trip |
| fuel\_used | float | liters | Yes | Fuel used in current trip |
| lat | float | decimal degrees | Yes | GPS latitude |
| lon | float | decimal degrees | Yes | GPS longitude |
| location | string | named place | Yes | Named geofence or empty string |
| geofence\_ok | boolean | true/false | Yes | Inside defined geofence \= true |
| low\_fuel | boolean | true/false | Yes | Device-side low fuel detection |
| parking | boolean | true/false | Yes | Parking mode \= theft-arm mode |
| overspeed | boolean | true/false | Yes | \>80 km/h threshold |
| alert | string|null | text | Yes | Device alert message or null |

## **1.3 Backend-Added Fields (added on receipt, not from device)**

The backend enriches the raw payload with the following fields before storing:

| Field | Type | Source | Description |
| :---- | :---- | :---- | :---- |
| deviceId | string | HTTP header / URL param | e.g. ESP32-001, identifies which device sent this |
| vehicleId | string | devices table lookup | Looked up from deviceId, e.g. V001 |
| receivedAt | ISO 8601 string | Server clock (UTC) | Exact server-side receipt timestamp |
| schemaVersion | string | Backend constant | e.g. '1.0', tracks payload version |
| source | string | Backend constant | 'hardware' or 'simulator' |

# **2\. Real-Time System Architecture**

## **2.1 Communication Model**

| Channel | Protocol | Direction | Used For |
| :---- | :---- | :---- | :---- |
| Hardware → Backend | HTTP POST (REST) | One-way push | Telemetry ingestion from ESP32 |
| Backend → All Clients | WebSocket (ws://) | Server push | Live vehicle state, new alerts, all vehicles update |
| Frontend → Backend | REST (HTTP GET) | Request/response | Historical data, trips, alerts list, vehicle list |
| Frontend ↔ Backend | WebSocket | Bidirectional | Initial subscribe, receive live state |
| Backend → Backend | Internal function call | In-process | Rule engine, trip detection, alert generation |

## **2.2 WebSocket Architecture — How Live Data Reaches Frontend**

The backend maintains a single WebSocket server. When a new telemetry packet arrives from hardware via POST /api/telemetry, the backend:

* Validates and stores the packet (raw \+ normalized)  
* Upserts vehicle\_latest\_state table row  
* Runs alert rule engine  
* Broadcasts updated vehicle state to ALL connected WebSocket clients  
* Broadcasts any newly generated alert to ALL connected WebSocket clients

**WebSocket Connection Lifecycle:**

| 1\. Client opens:  ws://backend/ws 2\. Backend sends: { type: 'CONNECTED', payload: { connectedVehicles: \['V001','V002'\] } } 3\. Backend sends: { type: 'ALL\_VEHICLES\_STATE', payload: \[ ...latest state of all vehicles \] } 4\. Hardware sends POST /api/telemetry  →  backend processes  →  backend broadcasts:        { type: 'VEHICLE\_UPDATE', payload: { vehicleId, ...latest state } } 5\. If alert fires:        { type: 'ALERT\_FIRED', payload: { alertId, vehicleId, type, severity, message, ... } } 6\. Client disconnects: backend removes from active connections map |
| :---- |

**Server-Side WebSocket State Management:**

The backend maintains an in-memory Map of connected WebSocket clients:

| const clients \= new Map(); // key: ws object // value: { connectedAt, clientId } // On new telemetry received: function broadcastToAll(message) {   clients.forEach((meta, ws) \=\> {     if (ws.readyState \=== WebSocket.OPEN) {       ws.send(JSON.stringify(message));     }   }); } |
| :---- |

# **3\. Database Schema**

Technology: Supabase (managed Postgres). All timestamps are ISO 8601 UTC. All fuel in liters, distances in kilometers, speed in km/h.

## **3.1 Table: vehicles**

Static metadata for each registered vehicle.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| vehicleId | TEXT | PRIMARY KEY | e.g. V001, V002 |
| plateNumber | TEXT | NOT NULL, UNIQUE | e.g. ET-4321-AA |
| label | TEXT | NOT NULL | Human-readable name e.g. 'Truck Alpha' |
| tankCapacityLiters | FLOAT | NOT NULL | Used to compute fuel percentage |
| make | TEXT | NULLABLE | Vehicle make e.g. Toyota |
| model | TEXT | NULLABLE | Vehicle model e.g. Land Cruiser |
| year | INTEGER | NULLABLE | Manufacturing year |
| color | TEXT | NULLABLE | Vehicle color |
| assignedDriverId | TEXT | FK → drivers.driverId, NULLABLE | Currently assigned driver |
| assignedDeviceId | TEXT | FK → devices.deviceId, NULLABLE | Currently linked ESP32 device |
| status | TEXT | NOT NULL, DEFAULT 'active' | active | inactive | maintenance |
| createdAt | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Registration timestamp |
| updatedAt | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last metadata update |

## **3.2 Table: devices**

Hardware devices (ESP32 units). A device links to a vehicle. One device per vehicle at a time, but can be reassigned.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| deviceId | TEXT | PRIMARY KEY | e.g. ESP32-001 |
| vehicleId | TEXT | FK → vehicles.vehicleId, NULLABLE | Currently assigned vehicle, null if unassigned |
| firmwareVersion | TEXT | NULLABLE | e.g. v3.3 |
| lastSeenAt | TIMESTAMPTZ | NULLABLE | Timestamp of last received telemetry |
| status | TEXT | NOT NULL, DEFAULT 'offline' | online | stale | offline |
| registeredAt | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When device was registered by admin |
| registeredBy | TEXT | NOT NULL | Admin user ID who registered this device |

## **3.3 Table: drivers**

Driver records. Admin creates these. Each driver can be assigned to a vehicle.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| driverId | TEXT | PRIMARY KEY | e.g. DRV-001, UUID |
| fullName | TEXT | NOT NULL | Driver full name |
| licenseNumber | TEXT | NOT NULL, UNIQUE | Driver license number |
| phoneNumber | TEXT | NULLABLE | Contact phone |
| status | TEXT | NOT NULL, DEFAULT 'active' | active | suspended | inactive |
| createdAt | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When driver was registered |

## **3.4 Table: telemetry\_raw**

Preserves the exact received payload. Never mutated after insert. Used for debugging and audit.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| telemetryId | TEXT | PRIMARY KEY | UUID generated by backend |
| deviceId | TEXT | NOT NULL, FK → devices | Sending device |
| vehicleId | TEXT | NOT NULL, FK → vehicles | Derived from deviceId lookup |
| receivedAt | TIMESTAMPTZ | NOT NULL | Server-side receipt time (UTC) |
| rawPayload | JSONB | NOT NULL | Full raw JSON exactly as received from device |
| source | TEXT | NOT NULL | hardware | simulator |

## **3.5 Table: telemetry\_normalized**

Cleaned, typed, structured records. All downstream logic (charts, trips, rule engine) reads from here.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| telemetryId | TEXT | PRIMARY KEY, FK → telemetry\_raw | Same ID as raw record |
| vehicleId | TEXT | NOT NULL, FK → vehicles |  |
| deviceId | TEXT | NOT NULL, FK → devices |  |
| receivedAt | TIMESTAMPTZ | NOT NULL | Server receipt time |
| deviceUptimeMs | INTEGER | NOT NULL | From hardware 't' field |
| fuelLiters | FLOAT | NOT NULL | From fuel\_l |
| fuelPercent | INTEGER | NOT NULL | From fuel\_pct |
| engineOn | BOOLEAN | NOT NULL | From engine |
| doorOpen | BOOLEAN | NOT NULL | From door |
| tempCelsius | FLOAT | NOT NULL | From temp\_c |
| accelG | FLOAT | NOT NULL | From accel\_g |
| speedKmh | FLOAT | NOT NULL | From speed\_kmh |
| fuelRateLhr | FLOAT | NOT NULL | From rate\_lhr |
| tripSeconds | INTEGER | NOT NULL | From trip\_sec |
| tripFuelUsed | FLOAT | NOT NULL | From fuel\_used |
| latitude | FLOAT | NOT NULL | From lat |
| longitude | FLOAT | NOT NULL | From lon |
| locationName | TEXT | NULLABLE | From location |
| geofenceOk | BOOLEAN | NOT NULL | From geofence\_ok |
| lowFuelFlag | BOOLEAN | NOT NULL | From low\_fuel (device-side) |
| parkingMode | BOOLEAN | NOT NULL | From parking |
| overspeedFlag | BOOLEAN | NOT NULL | From overspeed |
| deviceAlertText | TEXT | NULLABLE | From alert field, null if no alert |

## **3.6 Table: vehicle\_latest\_state**

Single row per vehicle. Upserted on every telemetry event. Enables instant dashboard reads and WebSocket broadcasts without querying large telemetry tables.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| vehicleId | TEXT | PRIMARY KEY |  |
| lastSeenAt | TIMESTAMPTZ | NOT NULL | When last telemetry was received |
| fuelLiters | FLOAT | NOT NULL | Latest fuel level |
| fuelPercent | INTEGER | NOT NULL | Latest fuel percentage |
| engineOn | BOOLEAN | NOT NULL | Latest engine state |
| doorOpen | BOOLEAN | NOT NULL | Latest door state |
| tempCelsius | FLOAT | NOT NULL | Latest temperature |
| speedKmh | FLOAT | NOT NULL | Latest speed |
| accelG | FLOAT | NOT NULL | Latest acceleration |
| fuelRateLhr | FLOAT | NOT NULL | Latest consumption rate |
| latitude | FLOAT | NOT NULL | Latest GPS latitude |
| longitude | FLOAT | NOT NULL | Latest GPS longitude |
| locationName | TEXT | NULLABLE | Latest named location |
| geofenceOk | BOOLEAN | NOT NULL | Latest geofence status |
| parkingMode | BOOLEAN | NOT NULL | Latest parking mode flag |
| overspeedFlag | BOOLEAN | NOT NULL | Latest overspeed flag |
| deviceStatus | TEXT | NOT NULL | online | stale | offline |
| currentAlertLevel | TEXT | NOT NULL, DEFAULT 'none' | none | info | warning | critical |
| activeTripId | TEXT | FK → trips, NULLABLE | Current open trip, null if not moving |

## **3.7 Table: alerts**

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| alertId | TEXT | PRIMARY KEY | UUID |
| vehicleId | TEXT | NOT NULL, FK → vehicles |  |
| driverId | TEXT | FK → drivers, NULLABLE | Driver at time of alert |
| type | TEXT | NOT NULL | See alert types section |
| severity | TEXT | NOT NULL | info | warning | critical |
| status | TEXT | NOT NULL, DEFAULT 'open' | open | acknowledged | resolved |
| message | TEXT | NOT NULL | Human-readable description |
| evidence | JSONB | NOT NULL | Raw numeric values that triggered rule |
| createdAt | TIMESTAMPTZ | NOT NULL | When alert was generated |
| resolvedAt | TIMESTAMPTZ | NULLABLE | When resolved/acknowledged |

**Alert Types:**

| Type | Severity | Trigger |
| :---- | :---- | :---- |
| SUSPECTED\_FUEL\_DROP | critical | Fuel drops \> threshold while engine OFF and parking mode ON |
| LOW\_FUEL | warning | fuel\_pct \< 15% OR low\_fuel flag from device is true |
| OVERSPEED | warning | speed\_kmh \> 80 OR overspeed flag from device is true |
| DEVICE\_STALE | info | No telemetry received for \> 5 minutes |
| DEVICE\_OFFLINE | critical | No telemetry received for \> 15 minutes |
| DOOR\_OPEN\_PARKED | warning | Door open while engine OFF and parking mode ON |
| REFILL\_DETECTED | info | Fuel increases by \> 5L in one telemetry interval |
| GEOFENCE\_VIOLATION | warning | geofence\_ok \= false |
| DRIVER\_VIOLATION | warning | Any alert linked to a driver creates a violation record |

## **3.8 Table: trips**

Derived from telemetry. A trip starts when engine turns ON and ends when engine turns OFF. Computed by the backend, not sent from hardware.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| tripId | TEXT | PRIMARY KEY | UUID |
| vehicleId | TEXT | NOT NULL, FK → vehicles |  |
| driverId | TEXT | FK → drivers, NULLABLE | Driver assigned at trip start time |
| startTime | TIMESTAMPTZ | NOT NULL | When engine turned ON (from telemetry) |
| endTime | TIMESTAMPTZ | NULLABLE | When engine turned OFF, null if trip still open |
| startFuelLiters | FLOAT | NOT NULL | Fuel level at trip start |
| endFuelLiters | FLOAT | NULLABLE | Fuel level at trip end |
| fuelUsedLiters | FLOAT | NULLABLE | startFuel \- endFuel, computed on trip close |
| distanceKm | FLOAT | NULLABLE | Haversine sum of GPS points during trip |
| avgSpeedKmh | FLOAT | NULLABLE | Average of speedKmh readings |
| maxSpeedKmh | FLOAT | NULLABLE | Max speed recorded during trip |
| startLat | FLOAT | NOT NULL | GPS at trip start |
| startLon | FLOAT | NOT NULL | GPS at trip start |
| endLat | FLOAT | NULLABLE | GPS at trip end |
| endLon | FLOAT | NULLABLE | GPS at trip end |
| status | TEXT | NOT NULL, DEFAULT 'active' | active | completed |

## **3.9 Table: driver\_violations**

Every alert that involves a driver behavior (overspeed, fuel drop, door open parked) creates a violation record. This gives a full violation history per driver.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| violationId | TEXT | PRIMARY KEY | UUID |
| driverId | TEXT | NOT NULL, FK → drivers |  |
| vehicleId | TEXT | NOT NULL, FK → vehicles | Vehicle at time of violation |
| alertId | TEXT | NOT NULL, FK → alerts | The alert that caused this violation |
| tripId | TEXT | FK → trips, NULLABLE | Trip during which violation occurred |
| type | TEXT | NOT NULL | OVERSPEED | FUEL\_DROP | DOOR\_OPEN\_PARKED | GEOFENCE\_VIOLATION |
| severity | TEXT | NOT NULL | info | warning | critical |
| description | TEXT | NOT NULL | Human-readable e.g. 'Drove at 95 km/h on trip TRP-001' |
| occurredAt | TIMESTAMPTZ | NOT NULL | Timestamp of the event |

## **3.10 Table: user_profiles**

Manages user identity and application roles for human users. Links with Supabase auth via the `id` field.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | PRIMARY KEY | Matches auth.users.id from Supabase |
| email | TEXT | NOT NULL, UNIQUE | User email address |
| full_name | TEXT | NULLABLE | User's full name |
| role | TEXT | NOT NULL, DEFAULT 'viewer' | admin \| driver \| viewer |
| status | TEXT | NOT NULL, DEFAULT 'active' | active \| disabled |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When profile was created |

## **3.11 Table: user_vehicle_access**

Defines which vehicles a non-admin user (driver or viewer) has access to.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| id | UUID | PRIMARY KEY | Unique ID |
| user_id | UUID | NOT NULL, FK → user_profiles | The user granted access |
| vehicle_id | UUID | NOT NULL, FK → vehicles | The vehicle they can access |
| access_level | TEXT | NOT NULL | owner \| assigned_driver \| viewer |

## **3.12 Table: device_credentials**

Manages secure hardware ingestion tokens separate from human auth.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| device_id | TEXT | PRIMARY KEY | Device identifier e.g. ESP32-001 |
| token_hash | TEXT | NOT NULL | Hashed value of the hardware bearer token |
| status | TEXT | NOT NULL, DEFAULT 'active' | active \| revoked |
| last_rotated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last token rotation timestamp |

## **3.13 Table: admin\_users**

Hardcoded admin. No registration endpoint. Seeded at deploy time. Password is bcrypt-hashed.

| Column | Type | Constraints | Description |
| :---- | :---- | :---- | :---- |
| adminId | TEXT | PRIMARY KEY | UUID or hardcoded 'admin-001' |
| username | TEXT | NOT NULL, UNIQUE | e.g. 'admin' |
| passwordHash | TEXT | NOT NULL | bcrypt hash of password |
| lastLoginAt | TIMESTAMPTZ | NULLABLE | Last successful login |

# **4\. WebSocket Events Specification**

All WebSocket messages use JSON with this envelope:

| {   "type":      string,   // event type constant   "payload":   object,   // event-specific data   "timestamp": string    // ISO 8601 UTC, added by server } |
| :---- |

## **4.1 Server → Client Events (Backend broadcasts these)**

### **Event: CONNECTED**

Sent immediately when a client connects. Gives the client the current state of all vehicles.

| {   "type": "CONNECTED",   "payload": {     "connectedVehicles": \["V001", "V002"\],     "serverTime": "2026-05-18T10:00:00Z"   },   "timestamp": "2026-05-18T10:00:00Z" } |
| :---- |

### **Event: ALL\_VEHICLES\_STATE**

Sent immediately after CONNECTED. Full current state of every registered vehicle. Frontend uses this to populate the fleet overview before live updates start.

| {   "type": "ALL\_VEHICLES\_STATE",   "payload": {     "vehicles": \[       {         "vehicleId":       "V001",         "label":           "Truck Alpha",         "plateNumber":     "ET-4321",         "assignedDriver":  { "driverId": "DRV-001", "fullName": "Bekele Tadesse" },         "lastSeenAt":      "2026-05-18T09:58:00Z",         "fuelLiters":      2.93,         "fuelPercent":     4,         "engineOn":        true,         "doorOpen":        true,         "speedKmh":        5.9,         "accelG":          \-2.71,         "tempCelsius":     22.0,         "fuelRateLhr":     0.00,         "latitude":        9.0320,         "longitude":       38.7469,         "locationName":    "Home",         "geofenceOk":      true,         "parkingMode":     false,         "overspeedFlag":   false,         "deviceStatus":    "online",         "currentAlertLevel": "critical",         "activeTripId":    "TRP-0021"       }     \]   },   "timestamp": "2026-05-18T10:00:00Z" } |
| :---- |

### **Event: VEHICLE\_UPDATE**

Broadcast to ALL connected clients every time a new telemetry packet is processed for any vehicle. This is the primary real-time event that drives live dashboard updates.

| {   "type": "VEHICLE\_UPDATE",   "payload": {     "vehicleId":       "V001",     "label":           "Truck Alpha",     "plateNumber":     "ET-4321",     "lastSeenAt":      "2026-05-18T10:00:07Z",     "fuelLiters":      2.93,     "fuelPercent":     4,     "engineOn":        true,     "doorOpen":        true,     "speedKmh":        5.9,     "accelG":          \-2.71,     "tempCelsius":     22.0,     "fuelRateLhr":     0.00,     "latitude":        9.0320,     "longitude":       38.7469,     "locationName":    "Home",     "geofenceOk":      true,     "parkingMode":     false,     "overspeedFlag":   false,     "deviceStatus":    "online",     "currentAlertLevel": "critical",     "activeTripId":    "TRP-0021"   },   "timestamp": "2026-05-18T10:00:07Z" } |
| :---- |

### **Event: ALERT\_FIRED**

Broadcast to ALL connected clients when the rule engine generates a new alert. Frontend should display this as a real-time notification regardless of which screen the user is on.

| {   "type": "ALERT\_FIRED",   "payload": {     "alertId":    "ALT-0043",     "vehicleId":  "V001",     "vehicleLabel": "Truck Alpha",     "driverId":   "DRV-001",     "driverName": "Bekele Tadesse",     "type":       "LOW\_FUEL",     "severity":   "warning",     "status":     "open",     "message":    "Fuel level at 4% (2.93 liters). Immediate refuel required.",     "evidence": {       "fuelLiters":  2.93,       "fuelPercent": 4,       "deviceFlag":  true     },     "createdAt":  "2026-05-18T10:00:07Z"   },   "timestamp": "2026-05-18T10:00:07Z" } |
| :---- |

### **Event: DEVICE\_STATUS\_CHANGE**

Broadcast when a device transitions between online / stale / offline. Triggered by the background stale-check job.

| {   "type": "DEVICE\_STATUS\_CHANGE",   "payload": {     "vehicleId":   "V001",     "deviceId":    "ESP32-001",     "prevStatus":  "online",     "newStatus":   "stale",     "lastSeenAt":  "2026-05-18T09:54:10Z"   },   "timestamp": "2026-05-18T10:00:00Z" } |
| :---- |

# **5\. REST API Endpoints**

Base URL: http://localhost:3000/api (development)

Authentication: All endpoints except POST /api/auth/login require Authorization: Bearer \<JWT\> header.

| Method | Endpoint | Auth Required | Description |
| :---- | :---- | :---- | :---- |
| POST | /api/auth/login | No | Admin login, returns JWT |
| POST | /api/telemetry | Device token | Hardware telemetry ingestion |
| GET | /api/vehicles | Yes | List all vehicles with current state |
| POST | /api/vehicles | Yes | Register a new vehicle |
| GET | /api/vehicles/:vehicleId | Yes | Get single vehicle current state |
| PATCH | /api/vehicles/:vehicleId | Yes | Update vehicle metadata |
| GET | /api/vehicles/:vehicleId/history | Yes | Historical telemetry (paginated) |
| GET | /api/vehicles/:vehicleId/trips | Yes | List trips for vehicle |
| GET | /api/vehicles/:vehicleId/alerts | Yes | List alerts for vehicle |
| GET | /api/devices | Yes | List all registered devices |
| POST | /api/devices | Yes | Register a new device |
| PATCH | /api/devices/:deviceId | Yes | Update device (assign/unassign vehicle) |
| GET | /api/drivers | Yes | List all drivers |
| POST | /api/drivers | Yes | Register a new driver |
| PATCH | /api/drivers/:driverId | Yes | Update driver info |
| GET | /api/drivers/:driverId/violations | Yes | Get violation history for a driver |
| GET | /api/alerts | Yes | List all alerts across all vehicles |
| PATCH | /api/alerts/:alertId | Yes | Acknowledge or resolve an alert |

## **5.1  POST /api/auth/login**

**Purpose: Admin login. No registration — admin is hardcoded and seeded at deploy time.**

**Request Body:**

| {   "username": "admin",      // string, required   "password": "yourpass"    // string, required } |
| :---- |

**Success Response — 200 OK:**

| {   "success": true,   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // JWT, expires in 24h   "admin": {     "adminId":   "admin-001",     "username":  "admin"   } } |
| :---- |

**Error Response — 401 Unauthorized:**

| {   "success": false,   "error": {     "code":    "INVALID\_CREDENTIALS",     "message": "Username or password is incorrect"   } } |
| :---- |

## **5.2  POST /api/telemetry**

**Purpose: Receive telemetry from ESP32 hardware. This is the only endpoint called by hardware.**

Auth: Device token in header → X-Device-Token: \<hardcoded shared secret\>

**Request Body (exact hardware JSON):**

| {   "t":           4632,   "fuel\_l":      2.93,   "fuel\_pct":    4,   "engine":      true,   "door":        true,   "temp\_c":      22.0,   "accel\_g":     \-2.71,   "speed\_kmh":   5.9,   "rate\_lhr":    0.00,   "trip\_sec":    0,   "fuel\_used":   0.00,   "lat":         9.0320,   "lon":         38.7469,   "location":    "Home",   "geofence\_ok": true,   "low\_fuel":    true,   "parking":     false,   "overspeed":   false,   "alert":       "Low fuel warning" } |
| :---- |

The Device ID is read from the X-Device-Id request header. The vehicleId is derived by looking up the device in the devices table.

**Processing Pipeline (in order):**

* 1\. Authenticate device token from header  
* 2\. Read X-Device-Id header, look up device in DB → get vehicleId  
* 3\. Validate all required fields present and correct types  
* 4\. Generate UUID for telemetryId  
* 5\. INSERT into telemetry\_raw (rawPayload \= full body JSON)  
* 6\. INSERT into telemetry\_normalized (mapped fields)  
* 7\. UPSERT vehicle\_latest\_state with new values  
* 8\. UPDATE devices.lastSeenAt and devices.status \= 'online'  
* 9\. Run trip detection logic (see Section 6\)  
* 10\. Run alert rule engine (see Section 7\)  
* 11\. Broadcast VEHICLE\_UPDATE via WebSocket to all clients  
* 12\. If new alerts generated, broadcast ALERT\_FIRED via WebSocket  
* 13\. Return 200 response

**Success Response — 200 OK:**

| {   "accepted":    true,   "telemetryId": "a1b2c3d4-...",   "vehicleId":   "V001",   "message":     "telemetry stored" } |
| :---- |

**Validation Error — 400 Bad Request:**

| {   "accepted": false,   "error": {     "code":    "INVALID\_PAYLOAD",     "message": "fuel\_l is required and must be a number"   } } |
| :---- |

**Unknown Device — 401:**

| {   "accepted": false,   "error": { "code": "UNKNOWN\_DEVICE", "message": "Device not registered" } } |
| :---- |

## **5.3  GET /api/vehicles**

**Purpose: List all vehicles with their current real-time state. Used for fleet overview page.**

**Query Parameters (all optional):**

| Parameter | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| status | string | all | Filter by vehicle status: active | inactive | maintenance | all |
| deviceStatus | string | all | Filter by device status: online | stale | offline | all |

**Success Response — 200 OK:**

| {   "success": true,   "count": 2,   "vehicles": \[     {       "vehicleId":     "V001",       "label":         "Truck Alpha",       "plateNumber":   "ET-4321",       "make":          "Toyota",       "model":         "Land Cruiser",       "status":        "active",       "assignedDriver": {         "driverId":  "DRV-001",         "fullName":  "Bekele Tadesse"       },       "assignedDevice": {         "deviceId": "ESP32-001",         "status":   "online"       },       "currentState": {         "lastSeenAt":        "2026-05-18T10:00:07Z",         "fuelLiters":        2.93,         "fuelPercent":       4,         "engineOn":          true,         "speedKmh":          5.9,         "latitude":          9.0320,         "longitude":         38.7469,         "locationName":      "Home",         "deviceStatus":      "online",         "currentAlertLevel": "critical"       }     }   \] } |
| :---- |

## **5.4  POST /api/vehicles**

**Purpose: Register a new vehicle. Admin only.**

**Request Body:**

| {   "vehicleId":          "V002",           // string, required, must be unique   "plateNumber":        "ET-9876-BB",     // string, required   "label":              "Van Beta",       // string, required   "tankCapacityLiters": 60,               // float, required   "make":               "Nissan",         // string, optional   "model":              "Patrol",         // string, optional   "year":               2020,             // integer, optional   "color":              "White",          // string, optional   "assignedDriverId":   "DRV-002",        // string, optional (can assign later)   "assignedDeviceId":   "ESP32-002"       // string, optional (can assign later) } |
| :---- |

**Success Response — 201 Created:**

| {   "success":   true,   "vehicleId": "V002",   "message":   "Vehicle registered successfully" } |
| :---- |

**Conflict — 409:**

| {   "success": false,   "error": { "code": "DUPLICATE\_VEHICLE\_ID", "message": "Vehicle V002 already exists" } } |
| :---- |

## **5.5  GET /api/vehicles/:vehicleId**

**Purpose: Full detail for a single vehicle — metadata \+ current state \+ open alerts count. Used for the vehicle detail page. Live data from vehicle\_latest\_state.**

**Success Response — 200 OK:**

| {   "success": true,   "vehicle": {     "vehicleId":          "V001",     "label":              "Truck Alpha",     "plateNumber":        "ET-4321",     "make":               "Toyota",     "model":              "Land Cruiser",     "year":               2019,     "color":              "White",     "tankCapacityLiters": 60,     "status":             "active",     "createdAt":          "2026-05-01T08:00:00Z",     "assignedDriver": {       "driverId":    "DRV-001",       "fullName":    "Bekele Tadesse",       "licenseNumber": "ETH-2021-4532"     },     "assignedDevice": {       "deviceId":        "ESP32-001",       "firmwareVersion": "v3.3",       "status":          "online",       "lastSeenAt":      "2026-05-18T10:00:07Z"     },     "currentState": {       "lastSeenAt":      "2026-05-18T10:00:07Z",       "fuelLiters":      2.93,       "fuelPercent":     4,       "engineOn":        true,       "doorOpen":        true,       "speedKmh":        5.9,       "accelG":          \-2.71,       "tempCelsius":     22.0,       "fuelRateLhr":     0.00,       "latitude":        9.0320,       "longitude":       38.7469,       "locationName":    "Home",       "geofenceOk":      true,       "parkingMode":     false,       "overspeedFlag":   false,       "deviceStatus":    "online",       "currentAlertLevel": "critical",       "activeTripId":    "TRP-0021"     },     "openAlertsCount": 2   } } |
| :---- |

## **5.6  GET /api/vehicles/:vehicleId/history**

**Purpose: Paginated historical telemetry for charts and timeline. Reads from telemetry\_normalized.**

**Query Parameters:**

| Parameter | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| from | ISO 8601 string | 24 hours ago | Start of time range |
| to | ISO 8601 string | now | End of time range |
| limit | integer | 200 | Max records returned |
| offset | integer | 0 | Pagination offset |
| fields | comma-separated string | all | Limit fields: e.g. timestamp,fuelLiters,speedKmh,latitude,longitude |

**Success Response — 200 OK:**

| {   "success":   true,   "vehicleId": "V001",   "from":      "2026-05-17T10:00:00Z",   "to":        "2026-05-18T10:00:00Z",   "total":     1440,   "count":     200,   "offset":    0,   "records": \[     {       "telemetryId":  "uuid-...",       "receivedAt":   "2026-05-18T10:00:07Z",       "fuelLiters":   2.93,       "fuelPercent":  4,       "engineOn":     true,       "doorOpen":     true,       "speedKmh":     5.9,       "accelG":       \-2.71,       "tempCelsius":  22.0,       "fuelRateLhr":  0.00,       "latitude":     9.0320,       "longitude":    38.7469,       "locationName": "Home",       "parkingMode":  false,       "overspeedFlag":false     }   \] } |
| :---- |

## **5.7  GET /api/vehicles/:vehicleId/trips**

**Purpose: List computed trips for a vehicle. Derived from telemetry, never sent from hardware.**

**Query Parameters:**

| Parameter | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| from | ISO 8601 string | 7 days ago | Start of time range |
| to | ISO 8601 string | now | End of time range |
| status | string | all | active | completed | all |
| limit | integer | 50 | Max trips |
| offset | integer | 0 | Pagination |

**Success Response — 200 OK:**

| {   "success":   true,   "vehicleId": "V001",   "count":     5,   "trips": \[     {       "tripId":          "TRP-0021",       "vehicleId":       "V001",       "driver": {         "driverId":  "DRV-001",         "fullName":  "Bekele Tadesse"       },       "startTime":       "2026-05-18T07:00:00Z",       "endTime":         null,       "status":          "active",       "startFuelLiters": 55.0,       "endFuelLiters":   null,       "fuelUsedLiters":  null,       "distanceKm":      12.3,       "avgSpeedKmh":     38.5,       "maxSpeedKmh":     67.2,       "startLat":        9.0100,       "startLon":        38.7200,       "endLat":          null,       "endLon":          null     }   \] } |
| :---- |

## **5.8  GET /api/vehicles/:vehicleId/alerts**

**Purpose: List alerts for a specific vehicle.**

**Query Parameters:**

| Parameter | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| status | string | open | open | acknowledged | resolved | all |
| severity | string | all | info | warning | critical | all |
| limit | integer | 50 | Max alerts |
| offset | integer | 0 | Pagination |

**Success Response — 200 OK:**

| {   "success":   true,   "vehicleId": "V001",   "count":     2,   "alerts": \[     {       "alertId":   "ALT-0043",       "vehicleId": "V001",       "driver": { "driverId": "DRV-001", "fullName": "Bekele Tadesse" },       "type":      "LOW\_FUEL",       "severity":  "warning",       "status":    "open",       "message":   "Fuel at 4% (2.93L). Immediate refuel required.",       "evidence":  { "fuelLiters": 2.93, "fuelPercent": 4, "deviceFlag": true },       "createdAt": "2026-05-18T10:00:07Z",       "resolvedAt": null     }   \] } |
| :---- |

## **5.9  POST /api/devices — Register Device**

**Purpose: Admin registers a new ESP32 device. Can optionally link to a vehicle immediately.**

**Request Body:**

| {   "deviceId":        "ESP32-002",    // string, required, must be unique   "vehicleId":       "V002",         // string, optional — assign to vehicle now   "firmwareVersion": "v3.3"          // string, optional } |
| :---- |

**Success Response — 201 Created:**

| {   "success":  true,   "deviceId": "ESP32-002",   "message":  "Device registered successfully" } |
| :---- |

## **5.10  PATCH /api/devices/:deviceId — Update / Reassign Device**

**Purpose: Reassign a device to a different vehicle, or unassign it. When reassigned, old vehicle loses the device link and new vehicle gains it.**

**Request Body (all fields optional, send only what changes):**

| {   "vehicleId":       "V003",    // reassign to new vehicle, or null to unassign   "firmwareVersion": "v3.4"     // update firmware version record } |
| :---- |

**Success Response — 200 OK:**

| {   "success":  true,   "deviceId": "ESP32-002",   "message":  "Device updated. Assigned to V003." } |
| :---- |

## **5.11  POST /api/drivers — Register Driver**

**Request Body:**

| {   "fullName":      "Chaltu Gemechu",     // string, required   "licenseNumber": "ETH-2022-9871",      // string, required, must be unique   "phoneNumber":   "+251912345678"        // string, optional } |
| :---- |

**Success Response — 201 Created:**

| {   "success":  true,   "driverId": "DRV-003",   "message":  "Driver registered" } |
| :---- |

## **5.12  GET /api/drivers/:driverId/violations — Driver Violation History**

**Purpose: Full violation history for a driver. Each overspeed, fuel drop, door-open-parked, or geofence violation is stored here.**

**Query Parameters:**

| Parameter | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| from | ISO 8601 string | 30 days ago | Start of time range |
| to | ISO 8601 string | now | End of time range |
| type | string | all | OVERSPEED | FUEL\_DROP | DOOR\_OPEN\_PARKED | GEOFENCE\_VIOLATION | all |
| limit | integer | 50 | Max violations |

**Success Response — 200 OK:**

| {   "success":  true,   "driverId": "DRV-001",   "driver": {     "fullName":      "Bekele Tadesse",     "licenseNumber": "ETH-2021-4532",     "status":        "active"   },   "totalViolations": 3,   "violations": \[     {       "violationId":  "VIO-0012",       "type":         "OVERSPEED",       "severity":     "warning",       "description":  "Vehicle V001 recorded speed of 95 km/h during trip TRP-0019",       "vehicleId":    "V001",       "vehicleLabel": "Truck Alpha",       "tripId":       "TRP-0019",       "occurredAt":   "2026-05-15T14:23:00Z",       "alertId":      "ALT-0039"     }   \] } |
| :---- |

## **5.13  PATCH /api/alerts/:alertId — Acknowledge or Resolve Alert**

**Request Body:**

| {   "status": "acknowledged"   // acknowledged | resolved } |
| :---- |

**Success Response — 200 OK:**

| {   "success": true,   "alertId": "ALT-0043",   "status":  "acknowledged",   "message": "Alert acknowledged" } |
| :---- |

# **6\. Trip Detection Logic**

Trips are computed entirely by the backend by watching engine state changes across telemetry records. The hardware sends trip\_sec and fuel\_used as running counters within what it considers a trip, but the backend derives its own authoritative trip records.

## **6.1 Trip Start**

| Condition: incoming telemetry has engineOn \= true           AND vehicle\_latest\_state.engineOn was false (or no previous state) Action:   1\. INSERT into trips:        tripId \= new UUID        vehicleId \= from telemetry        driverId  \= vehicle.assignedDriverId at this moment        startTime \= receivedAt        startFuelLiters \= telemetry.fuelLiters        startLat/Lon \= telemetry.lat/lon        status \= 'active'   2\. UPDATE vehicle\_latest\_state.activeTripId \= new tripId |
| :---- |

## **6.2 Trip In Progress**

| Condition: engineOn \= true and active trip exists Action (on each telemetry packet during trip):   1\. Compute incremental distance from last GPS point:        Haversine(prev lat/lon, current lat/lon) → add to running distanceKm   2\. Track maxSpeedKmh if current speed \> stored max   3\. UPDATE trips SET distanceKm, maxSpeedKmh WHERE tripId \= activeTripId |
| :---- |

## **6.3 Trip End**

| Condition: incoming telemetry has engineOn \= false           AND vehicle\_latest\_state.engineOn was true Action:   1\. UPDATE trips SET:        endTime \= receivedAt        endFuelLiters \= telemetry.fuelLiters        fuelUsedLiters \= startFuelLiters \- endFuelLiters        avgSpeedKmh \= average of all speed readings during trip        endLat/Lon \= telemetry.lat/lon        status \= 'completed'   2\. UPDATE vehicle\_latest\_state.activeTripId \= null |
| :---- |

# **7\. Alert Rule Engine**

Runs synchronously after every telemetry insert. All thresholds are in a config file (not hardcoded). Before inserting any alert, check for existing open alert of the same type \+ vehicleId to avoid duplicates.

## **7.1 Rule: LOW\_FUEL**

| Field | Value |
| :---- | :---- |
| Trigger | telemetry.fuelPercent \< 15 OR telemetry.lowFuelFlag \== true |
| Severity | warning |
| Dedup | Skip if open LOW\_FUEL alert exists for this vehicleId |
| Driver link | violations table: yes, type \= FUEL\_DROP if also dropping |
| // Alert evidence object: {   "fuelLiters":  2.93,   "fuelPercent": 4,   "deviceFlag":  true    // whether device itself flagged low\_fuel } |  |

## **7.2 Rule: SUSPECTED\_FUEL\_DROP (Theft Detection)**

| Field | Value |
| :---- | :---- |
| Trigger | engine OFF AND parking mode ON AND fuel drops \> THEFT\_DROP\_LITERS within THEFT\_WINDOW\_MINUTES |
| Thresholds | THEFT\_DROP\_LITERS \= 4.0 L, THEFT\_WINDOW\_MINUTES \= 5 |
| Severity | critical |
| Detection method | Query last N normalized records within window, compare fuelLiters |
| Driver link | violations table: yes, type \= FUEL\_DROP |
| // Evidence object: {   "fuelBefore":    40.5,   "fuelAfter":     32.1,   "dropLiters":    8.4,   "windowMinutes": 3,   "engineOn":      false,   "parkingMode":   true } |  |

## **7.3 Rule: OVERSPEED**

| Field | Value |
| :---- | :---- |
| Trigger | telemetry.speedKmh \> 80 OR telemetry.overspeedFlag \== true |
| Severity | warning |
| Dedup | Allow new alert only if previous OVERSPEED resolved, or 10 min cooldown |
| Driver link | violations table: yes, type \= OVERSPEED |
| // Evidence object: {   "speedKmh":    95.2,   "threshold":   80,   "deviceFlag":  true,   "tripId":      "TRP-0021" } |  |

## **7.4 Rule: DOOR\_OPEN\_PARKED**

| Field | Value |
| :---- | :---- |
| Trigger | doorOpen \== true AND engineOn \== false AND parkingMode \== true |
| Severity | warning |
| Dedup | Skip if open DOOR\_OPEN\_PARKED alert exists |
| Driver link | violations table: yes, type \= DOOR\_OPEN\_PARKED |

## **7.5 Rule: GEOFENCE\_VIOLATION**

| Field | Value |
| :---- | :---- |
| Trigger | telemetry.geofenceOk \== false |
| Severity | warning |
| Dedup | Skip if open GEOFENCE\_VIOLATION exists for this vehicle |
| Driver link | violations table: yes, type \= GEOFENCE\_VIOLATION |

## **7.6 Rule: REFILL\_DETECTED**

| Field | Value |
| :---- | :---- |
| Trigger | fuelLiters increased by \> REFILL\_MIN\_LITERS vs previous telemetry |
| Threshold | REFILL\_MIN\_LITERS \= 5.0 L |
| Severity | info |
| Dedup | Always create (refills are distinct events, not conditions) |
| Driver link | No violation created |

## **7.7 Rule: DEVICE\_STALE / DEVICE\_OFFLINE**

Run by a background job every 60 seconds (setInterval or cron), not on telemetry receipt.

| Condition | Status | Alert Type | Severity |
| :---- | :---- | :---- | :---- |
| now \- lastSeenAt \> 5 min | stale | DEVICE\_STALE | info |
| now \- lastSeenAt \> 15 min | offline | DEVICE\_OFFLINE | critical |

On status change: UPDATE devices.status, broadcast DEVICE\_STATUS\_CHANGE via WebSocket, create alert if not already open.

# **8\. Standard Error Response Format**

All error responses follow this structure:

| {   "success": false,   "error": {     "code":    "ERROR\_CODE\_CONSTANT",   // machine-readable     "message": "Human readable text"    // for logging/display   } } |
| :---- |

| HTTP Status | Error Code | When Used |
| :---- | :---- | :---- |
| 400 | INVALID\_PAYLOAD | Missing or wrong-type fields in request body |
| 400 | VALIDATION\_ERROR | Business rule violation (e.g. tankCapacity must be \> 0\) |
| 401 | INVALID\_CREDENTIALS | Wrong username/password on login |
| 401 | MISSING\_TOKEN | No Authorization header on protected route |
| 401 | INVALID\_TOKEN | JWT expired or tampered |
| 401 | UNKNOWN\_DEVICE | X-Device-Id not found in devices table |
| 403 | FORBIDDEN | Valid token but insufficient permission |
| 404 | NOT\_FOUND | vehicleId, deviceId, driverId, alertId not found |
| 409 | DUPLICATE\_VEHICLE\_ID | Registering vehicle with existing ID |
| 409 | DUPLICATE\_DEVICE\_ID | Registering device with existing ID |
| 409 | DUPLICATE\_LICENSE | Registering driver with existing license number |
| 500 | INTERNAL\_ERROR | Unexpected server error |

# **9\. Implementation Summary**

## **9.1 Tech Stack**

| Component | Technology | Notes |
| :---- | :---- | :---- |
| Runtime | Node.js \+ Express | REST API server |
| WebSocket | ws npm package | WebSocket server on same port or separate port |
| Database | Supabase (Postgres) | ORM: Prisma |
| Auth | jsonwebtoken (JWT) | bcrypt for password hashing |
| Validation | zod | Schema validation for all incoming payloads |
| Background jobs | node-cron | Device stale/offline detection job every 60s |
| Environment | .env via dotenv | Never commit credentials |

## **9.2 Environment Variables Required**

```env
APP_NAME=Fuel-Aware Backend
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
SUPABASE_PRISMA_URL=
SUPABASE_DIRECT_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=24h
AUTH_DEVICE_TOKEN_PEPPER=
TELEMETRY_TABLE=telemetry_normalized
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
AI_RUNTIME=python
```

## **9.3 Recommended Folder Structure**

| backend/   src/     routes/       auth.js       telemetry.js       vehicles.js       devices.js       drivers.js       alerts.js     services/       telemetryService.js    // ingestion pipeline       alertRuleEngine.js     // all 7 alert rules       tripService.js         // trip open/update/close       websocketService.js    // broadcast helpers       staleCheckJob.js       // background cron     middleware/       authMiddleware.js      // JWT check       deviceAuthMiddleware.js // device token check     db/       supabaseClient.js       schema.sql             // table definitions     websocket/       wsServer.js            // WebSocket server setup     config/       thresholds.js          // reads from .env     app.js     server.js   tests/   .env.example   package.json |
| :---- |

## **9.4 P0 Build Order (What to build first)**

| \# | Task | Owner | Unlocks |
| :---- | :---- | :---- | :---- |
| 1 | DB schema SQL — all 9 tables | CSE | Everything |
| 2 | POST /api/telemetry (no rules yet) | CSE | Hardware can start posting |
| 3 | WebSocket server \+ VEHICLE\_UPDATE broadcast | CSE | SE can connect and receive live data |
| 4 | GET /api/vehicles \+ GET /api/vehicles/:id | CSE | SE fleet overview page |
| 5 | Alert rule engine — LOW\_FUEL \+ SUSPECTED\_FUEL\_DROP | CSE | ALERT\_FIRED events broadcast |
| 6 | Trip detection logic | CSE | Trips page, driver violations |
| 7 | POST /api/auth/login | CSE | Admin login page |
| 8 | POST /api/vehicles \+ POST /api/devices \+ POST /api/drivers | CSE | Admin management screens |
| 9 | GET /api/vehicles/:id/history \+ /trips \+ /alerts | CSE | SE historical pages |
| 10 | PATCH /api/devices/:id (reassign) | CSE | Device management |
| 11 | GET /api/drivers/:id/violations | CSE | Driver violation history screen |
| 12 | Remaining alert rules \+ DEVICE\_STALE job | CSE | Complete alert coverage |

