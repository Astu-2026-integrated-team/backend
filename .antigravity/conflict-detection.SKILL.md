---
name: conflict-detection
description: "Use this skill before implementing ANY change in the FuelGuard backend. Detects conflicts between proposed changes and existing code, schema, API contracts, alert rules, WebSocket events, and documentation. Triggers: before writing any new file, modifying any existing file, adding any endpoint, or changing any database schema. Prevents contradictory logic from entering the codebase."
---

# Conflict Detection — FuelGuard Backend

## When to Run

Run conflict detection BEFORE writing any code. The check is mandatory for:

- Any new table, column, or migration
- Any new or modified API endpoint
- Any new or modified alert rule
- Any new or modified WebSocket event
- Any change to trip detection logic
- Any change to authentication or middleware
- Any new environment variable

---

## Conflict Categories

### Category 1: Schema Conflicts

Check for these before any DB change:

| Conflict Type | Check |
|---|---|
| Duplicate column name | Does this column already exist in this table? |
| Duplicate table name | Does this table already exist? |
| FK reference mismatch | Does the referenced table + column exist? |
| Type mismatch | Is the type consistent with how the field is used in services? |
| Naming inconsistency | Does the column name follow the camelCase rule for normalized tables? |
| Missing NOT NULL default | Does the column have a default if NOT NULL? |

FuelGuard schema reference tables: `vehicles`, `devices`, `drivers`, `telemetry_raw`, `telemetry_normalized`, `vehicle_latest_state`, `alerts`, `trips`, `driver_violations`, `admin_users`

### Category 2: API Contract Conflicts

Before adding or modifying an endpoint:

| Conflict Type | Check |
|---|---|
| Route collision | Is this path + method already defined in routes/? |
| Response shape mismatch | Does the response match the shape in FuelGuard_Backend_Spec.md? |
| Auth inconsistency | Is auth level (JWT vs device token vs none) consistent with spec? |
| Field rename | If renaming a response field, does it break existing frontend consumers? |
| Status code mismatch | Are HTTP status codes consistent with Section 8 error table? |
| Missing error code | Is every error case covered by an error code from Section 8? |

### Category 3: Alert Rule Conflicts

Before adding or modifying an alert rule:

| Conflict Type | Check |
|---|---|
| Duplicate rule trigger | Does another rule already fire on the same condition? |
| Threshold conflict | Does the new threshold contradict an existing threshold in config/thresholds.ts? |
| Severity inconsistency | Is severity level consistent with the same type across rules? |
| Dedup conflict | Does this rule's dedup logic contradict another active rule's dedup? |
| Missing violation link | Does a driver-behavior rule create a driver_violations record? |

Existing rules: `LOW_FUEL`, `SUSPECTED_FUEL_DROP`, `OVERSPEED`, `DOOR_OPEN_PARKED`, `GEOFENCE_VIOLATION`, `REFILL_DETECTED`, `DEVICE_STALE`, `DEVICE_OFFLINE`

### Category 4: WebSocket Event Conflicts

| Conflict Type | Check |
|---|---|
| Duplicate event type | Does this event `type` string already exist? |
| Payload shape conflict | Does the payload shape contradict an existing event's shape? |
| Broadcast trigger conflict | Does this event fire on the same trigger as another event? |
| Missing timestamp | Does the event envelope include `type`, `payload`, `timestamp`? |

Existing events: `CONNECTED`, `ALL_VEHICLES_STATE`, `VEHICLE_UPDATE`, `ALERT_FIRED`, `DEVICE_STATUS_CHANGE`

### Category 5: Service Layer Conflicts

| Conflict Type | Check |
|---|---|
| Duplicate function name | Is this function name already used in this service file? |
| Business logic contradiction | Does this logic contradict logic in another service? |
| Circular dependency | Would importing this create a circular require/import? |
| State mutation conflict | Does this mutate state that another service also mutates? |

Key services: `telemetryService.ts`, `alertRuleEngine.ts`, `tripService.ts`, `websocketService.ts`, `staleCheckJob.ts`

### Category 6: Naming Conflicts

| Conflict Type | Check |
|---|---|
| File name collision | Does this filename already exist in the target directory? |
| Variable name shadowing | Does this variable shadow an outer scope variable? |
| Constant name collision | Does this constant already exist in config/thresholds.ts? |
| Env var collision | Is this env var name already in .env.example? |

---

## Conflict Resolution Protocol

When a conflict is detected, Antigravity MUST stop and present this prompt:

```
⚠️  CONFLICT DETECTED: [Category Name]

What I want to do:
  [description of proposed change]

What already exists that conflicts:
  [description of existing thing]
  File: [path]
  Line: [line number if applicable]

Why this is a conflict:
  [explanation]

OPTIONS:
  A) [resolution option 1]
  B) [resolution option 2]
  C) [resolution option 3 if applicable]
  D) Let me describe a different approach

Which option? (A/B/C/D or describe):
```

Do NOT proceed until the user selects an option or describes an alternative.

---

## Pre-Implementation Scan Checklist

Run this scan before every implementation session:

```bash
# 1. Check for existing routes that might conflict
grep -r "router\.\(get\|post\|patch\|delete\)" src/routes/ --include="*.js"

# 2. Check for existing alert rule types
grep -r "type:" src/services/alertRuleEngine.ts

# 3. Check for existing WebSocket event types
grep -r "type:" src/websocket/ --include="*.js"

# 4. Check existing env vars
cat .env.example

# 5. Check existing table names in schema
grep -r "CREATE TABLE" src/db/schema.sql

# 6. Check existing service function names
grep -r "^function\|^const.*= async\|^async function" src/services/ --include="*.js"
```

---

## Spec Authority

The file `docs/FuelGuard_Backend_Spec.md` is the single source of truth. When any conflict exists between code and spec:

1. The spec wins unless the spec itself is wrong
2. If the spec is wrong, update the spec FIRST (own PR: `docs/` branch)
3. Then update code to match the updated spec

Never implement something that contradicts the spec without first updating the spec.

---

## Idempotency Checks

These operations MUST be idempotent — check before implementing:

| Operation | Idempotency Requirement |
|---|---|
| `UPSERT vehicle_latest_state` | Must not create duplicates on repeated telemetry |
| Alert dedup check | Must check for existing open alert before INSERT |
| Trip start | Must not open two active trips for same vehicle |
| Device status update | Must not broadcast if status hasn't changed |
| Stale check job | Must not create duplicate DEVICE_STALE alerts |

---

## Breaking Change Detection

A breaking change is any modification that would cause existing frontend clients or hardware to fail. Flag these immediately:

**Breaking (requires versioning discussion):**
- Removing a field from an API response
- Renaming a field in an API response
- Changing an HTTP status code
- Changing a WebSocket event type string
- Removing an endpoint
- Changing authentication method

**Non-breaking (safe to merge):**
- Adding a new optional field to a response
- Adding a new endpoint
- Adding a new WebSocket event type
- Tightening validation on a new optional field

When a breaking change is detected:
```
⚠️  BREAKING CHANGE DETECTED

This change would break:
  [list of affected clients/consumers]

Breaking change type: [field removal / rename / status code / etc]

This requires:
  1. Version bump discussion
  2. Migration plan for consumers
  3. Explicit approval before proceeding

Proceed? (yes/no):
```