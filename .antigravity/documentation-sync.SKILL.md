---
name: documentation-sync
description: "Use this skill whenever any code change could affect API contracts, database schema, alert rules, WebSocket events, or system architecture in the FuelGuard backend. Triggers: adding an endpoint, changing a response shape, adding a DB column, adding an alert type, changing an env var, changing error codes, or any behavioral change. Ensures docs/FuelGuard_Backend_Spec.md stays in sync with code."
---

# Documentation Sync — FuelGuard Backend

## Source of Truth

`docs/FuelGuard_Backend_Spec.md` is the authoritative spec. Every code change that changes observable behavior MUST also update the spec.

**Rule:** Documentation PRs precede code PRs when the spec needs updating. Never implement code that contradicts the current spec without first merging a spec update.

---

## What Requires a Doc Update

| Change | Doc Section to Update |
|---|---|
| New API endpoint | Section 5 — add endpoint entry |
| Modified endpoint request body | Section 5 — update request fields |
| Modified endpoint response shape | Section 5 — update response example |
| New query parameter | Section 5 — add to query params table |
| New HTTP error code | Section 8 — add to error table |
| New database table | Section 3 — add table definition |
| New database column | Section 3 — update table definition |
| New alert rule | Section 7 — add rule entry |
| Modified alert threshold | Section 7 — update threshold value AND Section 9.2 env var |
| New WebSocket event | Section 4 — add event definition |
| Modified WebSocket payload | Section 4 — update event payload example |
| New environment variable | Section 9.2 — add to env var table |
| New npm dependency | Section 9.1 — update tech stack if significant |
| Changed folder structure | Section 9.3 — update folder layout |

---

## Documentation PR Process

When a code change requires a doc update:

```
PR Stack Order:
  PR 1: docs/<scope>-update-spec  ← update FuelGuard_Backend_Spec.md FIRST
  PR 2: feat/<scope>-implementation ← code PR stacks on top of docs PR
```

The spec PR is reviewed and merged before the code PR is submitted. This ensures:
1. The team agrees on the contract before implementation
2. The spec never lags behind code
3. PR reviewers can verify implementation matches spec

---

## Spec Update Format

### Adding a New Endpoint

Add under the correct section header in `docs/FuelGuard_Backend_Spec.md`:

```markdown
### 5.X  METHOD /api/path — Short Description
Purpose: One sentence describing what this endpoint does and when it is used.

**Auth:** JWT required / Device token / None

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| param | string | default | description |

**Request Body:**
\```json
{
  "field": "value",   // type, required/optional
}
\```

**Success Response — 200 OK:**
\```json
{
  "success": true,
  "data": { ... }
}
\```

**Error Responses:**

| Status | Code | When |
|---|---|---|
| 400 | INVALID_PAYLOAD | ... |
| 404 | NOT_FOUND | ... |
```

### Adding a New Alert Rule

Add under Section 7:

```markdown
### 7.X Rule: RULE_TYPE_NAME

| Field | Value |
|---|---|
| Trigger | condition description |
| Severity | info / warning / critical |
| Dedup | dedup logic |
| Driver link | yes/no, violation type |

\```json
// Evidence object:
{
  "field": value
}
\```
```

### Adding a New WebSocket Event

Add under Section 4:

```markdown
**Event: EVENT_TYPE_NAME**
Brief description of when this fires and what the frontend should do with it.

\```json
{
  "type": "EVENT_TYPE_NAME",
  "payload": {
    "field": "value"
  },
  "timestamp": "2026-05-18T10:00:00Z"
}
\```
```

---

## Swagger Sync Rules

Every endpoint in `docs/FuelGuard_Backend_Spec.md` Section 5 MUST have a matching entry in `src/docs/openapi.yaml`.

When updating the spec, also update:
1. The relevant `paths` entry in `openapi.yaml`
2. Any `components/schemas` that the endpoint references
3. The `components/responses` if a new error response pattern is introduced

---

## README Sync

`README.md` (project root) must stay current with:
- How to run the server
- Environment variable names (not values — those stay in .env)
- How to run tests
- API docs URL (`/api/docs`)
- Folder structure (high level)

README does NOT duplicate the full spec. It links to `docs/FuelGuard_Backend_Spec.md` for full detail.

---

## CHANGELOG

Every merged PR updates `CHANGELOG.md` with an entry:

```markdown
## [Unreleased]

### Added
- POST /api/vehicles — vehicle registration endpoint (PR #14)
- LOW_FUEL alert rule — fires when fuelPercent < 15% (PR #16)

### Changed
- GET /api/vehicles — added deviceStatus filter query param (PR #18)

### Fixed
- Trip end detection — now correctly handles engine state transition on boot (PR #20)

### Deprecated
(nothing)

### Removed
(nothing)
```

Format: Keep a Changelog (https://keepachangelog.com). Sections: Added, Changed, Fixed, Deprecated, Removed.

---

## Documentation Checklist (Per PR)

Run this before every PR submission:

- [ ] Does this PR add a new endpoint? → Section 5 updated
- [ ] Does this PR change any response field? → Section 5 example updated
- [ ] Does this PR change any DB table? → Section 3 updated
- [ ] Does this PR add a new alert rule? → Section 7 updated
- [ ] Does this PR change any threshold? → Section 7 + Section 9.2 updated
- [ ] Does this PR add a WebSocket event? → Section 4 updated
- [ ] Does this PR add an env var? → Section 9.2 + .env.example updated
- [ ] Does this PR change folder structure? → Section 9.3 updated
- [ ] `CHANGELOG.md` has an entry for this change
- [ ] `src/docs/openapi.yaml` is in sync with any API changes
- [ ] README.md is still accurate

---

## Conflict: Code vs Spec

If Antigravity detects that existing code does NOT match the spec:

```
⚠️  DOCUMENTATION CONFLICT

Code at: src/routes/vehicles.ts line 34
Returns: { success: true, data: [...] }

Spec says (Section 5.3): { success: true, count: N, vehicles: [...] }

These do not match. OPTIONS:
  A) Fix code to match spec (recommended)
  B) Update spec to match code (if code is intentionally different)
  C) Flag for team discussion before proceeding

Which option? (A/B/C):
```