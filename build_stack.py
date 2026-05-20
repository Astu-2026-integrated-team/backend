#!/usr/bin/env python3
"""Build the new PR stack with logical grouping."""
import argparse
import os
import subprocess
import sys

BACKUP = "backup/all-changes"
OLD_BRANCHES = [
    "chore/ci-01-pipeline","chore/config-01-env-thresholds","db/schema-01-core-tables",
    "db/schema-02-auth-tables","feat/auth-01-service","feat/auth-02-route",
    "feat/auth-03-middleware","test/auth-04-tests","feat/vehicles-01-repository",
    "feat/vehicles-02-service","feat/vehicles-03-route","feat/vehicles-04-swagger",
    "test/vehicles-05-tests","feat/devices-01-repository","feat/devices-02-service",
    "feat/devices-03-route","feat/devices-04-swagger","test/devices-05-tests",
    "feat/drivers-01-repository","feat/drivers-02-service","feat/drivers-03-route",
    "feat/drivers-04-swagger","test/drivers-05-tests","feat/telemetry-01-ws-server",
    "feat/telemetry-02-trip-service","feat/telemetry-03-ingestion","feat/telemetry-04-route",
    "feat/telemetry-05-swagger","test/telemetry-06-tests","feat/alerts-01-rule-engine",
    "feat/alerts-02-service","feat/alerts-03-route","feat/alerts-04-swagger",
    "test/alerts-05-tests","feat/cron-01-stale-check","test/cron-02-tests",
    "test-branch",
]

parser = argparse.ArgumentParser(description="Build the new PR stack with logical grouping.")
parser.add_argument("--dry-run", action="store_true", help="Print commands without executing them.")
args = parser.parse_args()

DRY_RUN = args.dry_run

def run(cmd):
    if DRY_RUN:
        print(f"  DRY-RUN: {cmd}")
        return subprocess.CompletedProcess(cmd, 0, "", "")
    r = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    if r.returncode != 0:
        print(f"  WARN: {cmd}\n  {r.stderr.strip()}")
    return r

def run_ok(cmd):
    if DRY_RUN:
        print(f"  DRY-RUN: {cmd}")
        return subprocess.CompletedProcess(cmd, 0, "", "")
    r = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    if r.returncode != 0:
        print(f"  FAIL: {cmd}\n  {r.stderr.strip()}")
        sys.exit(1)
    return r

# ── Step 1: Delete old branches ──────────────────────────────────────────
print("=== Deleting old local + remote branches ===")
run_ok("git checkout main")
for b in OLD_BRANCHES:
    run(f"git branch -D {b}")
    run(f"git push origin --delete {b}")

# ── Step 2: Define new PRs ──────────────────────────────────────────────
# app.ts versions (incremental)
APP_V1 = """import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

export default app;
"""

APP_V4 = """import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

export default app;
"""

APP_V5 = """import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import vehiclesRoutes from './routes/vehicles';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);

export default app;
"""

APP_V6 = """import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import vehiclesRoutes from './routes/vehicles';
import devicesRoutes from './routes/devices';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/devices', devicesRoutes);

export default app;
"""

APP_V7 = """import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import vehiclesRoutes from './routes/vehicles';
import devicesRoutes from './routes/devices';
import driversRoutes from './routes/drivers';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/drivers', driversRoutes);

export default app;
"""

APP_V8 = """import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import telemetryRoutes from './routes/telemetry';
import vehiclesRoutes from './routes/vehicles';
import devicesRoutes from './routes/devices';
import driversRoutes from './routes/drivers';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/drivers', driversRoutes);

export default app;
"""

APP_V9 = """import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import telemetryRoutes from './routes/telemetry';
import vehiclesRoutes from './routes/vehicles';
import devicesRoutes from './routes/devices';
import driversRoutes from './routes/drivers';
import alertsRoutes from './routes/alerts';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/alerts', alertsRoutes);

export default app;
"""

# Final app.ts (with swagger) — matches the original file exactly
APP_FINAL = """import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

import authRoutes from './routes/auth';
import telemetryRoutes from './routes/telemetry';
import vehiclesRoutes from './routes/vehicles';
import devicesRoutes from './routes/devices';
import driversRoutes from './routes/drivers';
import alertsRoutes from './routes/alerts';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/alerts', alertsRoutes);

// Swagger UI
try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  console.error(`Failed to load Swagger definition: ${e.message}`);
}

export default app;
"""

SERVER_V1 = """require('dotenv').config();
import http from 'http';
import app from './app';

const port = Number(process.env.APP_PORT || 8000);
const host = process.env.APP_HOST || '0.0.0.0';

const server = http.createServer(app);

server.listen(port, host, () => {
  console.warn(`Server running on http://${host}:${port}`);
});

export default server;
"""

SERVER_V8 = """require('dotenv').config();
import http from 'http';
import app from './app';
import { initWsServer  } from './websocket/ws-server';
import { sendAllVehiclesState  } from './services/websocket-service';
import { listVehicles  } from './services/vehicle-service';

const port = Number(process.env.APP_PORT || 8000);
const host = process.env.APP_HOST || '0.0.0.0';

const server = http.createServer(app);

// Initialize WebSocket server and provide onConnect handler
initWsServer(server, async (ws) => {
  try {
    // Fetch all vehicles
    const result = await listVehicles({ status: 'all', deviceStatus: 'all' });
    sendAllVehiclesState(ws, result.vehicles);
  } catch (err) {
    console.error('Error in WS onConnect:', err);
  }
});

server.listen(port, host, () => {
  console.warn(`Server running on http://${host}:${port}`);
});

export default server;
"""

SERVER_FINAL = """require('dotenv').config();
import http from 'http';
import app from './app';
import { initWsServer  } from './websocket/ws-server';
import { sendAllVehiclesState  } from './services/websocket-service';
import { listVehicles  } from './services/vehicle-service';
import { startStaleCheckJob  } from './services/stale-check-job';

const port = Number(process.env.APP_PORT || 8000);
const host = process.env.APP_HOST || '0.0.0.0';

const server = http.createServer(app);

// Initialize WebSocket server and provide onConnect handler
initWsServer(server, async (ws) => {
  try {
    // Fetch all vehicles
    const result = await listVehicles({ status: 'all', deviceStatus: 'all' });
    sendAllVehiclesState(ws, result.vehicles);
  } catch (err) {
    console.error('Error in WS onConnect:', err);
  }
});

server.listen(port, host, () => {
  console.warn(`Server running on http://${host}:${port}`);

  // Start background job
  startStaleCheckJob();
});

export default server;
"""

PRs = [
    {
        "branch": "chore/project-foundation",
        "title": "chore: add CI pipeline, build config, and project foundation",
        "summary": "Sets up GitHub Actions CI, ESLint, Jest, TypeScript config, package dependencies, and the minimal Express app skeleton. Removes old Prisma-based tests and replaces the entry point.",
        "base": "main",
        "checkout_files": [
            ".github/workflows/ci.yml", ".eslintrc.cjs", "eslint.config.js",
            "jest.config.ts", "jest.setup.ts", "tsconfig.json", ".gitignore",
            "package.json", "package-lock.json", "src/types/express/index.d.ts",
            "tools/convert-syntax.js", "tools/fix-lint.js", "tools/fix-ts-2.js",
            "tools/fix-ts-3.js", "tools/fix-ts-4.js", "tools/fix-ts-5.js",
            "tools/fix-ts.js", "tools/fix-ts-tests.js", "tools/upgrade-to-ts.js",
            "tests/scratch_thenable.js", "ts-errors.log",
        ],
        "delete_files": [
            "src/__tests__/app-prisma.test.ts", "src/__tests__/app.test.ts",
            "src/__tests__/auth-errors.test.ts", "src/__tests__/auth-login.test.ts",
            "src/__tests__/env-optional-empty.test.ts", "src/__tests__/env.test.ts",
            "src/__tests__/error-handler.test.ts", "src/__tests__/jwt.test.ts",
            "src/__tests__/prisma.test.ts", "src/__tests__/require-role.test.ts",
            "src/__tests__/require-user.test.ts", "src/__tests__/resolve-profile.test.ts",
            "src/index.ts",
        ],
        "write_files": {"src/app.ts": APP_V1, "src/server.ts": SERVER_V1},
    },
    {
        "branch": "chore/config-env-thresholds",
        "title": "chore(config): add environment constants and threshold configuration",
        "summary": "Adds src/config/constants.ts with environment variable parsing and src/config/thresholds.ts with alert threshold rules used by the telemetry pipeline.",
        "base": "chore/project-foundation",
        "checkout_files": ["src/config/constants.ts", "src/config/thresholds.ts"],
        "delete_files": [],
        "write_files": {},
    },
    {
        "branch": "db/schema-and-client",
        "title": "db(schema): add database schemas, seed data, and Supabase client",
        "summary": "Adds the core SQL schema for vehicles, telemetry, trips, alerts, and auth tables. Includes admin seed migration and the Supabase client wrapper.",
        "base": "chore/config-env-thresholds",
        "checkout_files": ["src/db/schema.sql", "src/db/002_seed_admin.sql", "src/db/supabase-client.ts"],
        "delete_files": [],
        "write_files": {},
    },
    {
        "branch": "feat/auth-endpoint",
        "title": "feat(auth): add auth service, login route, and JWT middleware",
        "summary": "Implements the auth service for JWT token handling, the POST /api/auth/login endpoint, and both JWT and device authentication middleware.",
        "base": "db/schema-and-client",
        "checkout_files": [
            "src/services/auth-service.ts", "src/routes/auth.ts", "src/routes/index.ts",
            "src/middleware/auth-middleware.ts", "src/middleware/device-auth-middleware.ts",
        ],
        "delete_files": [],
        "write_files": {"src/app.ts": APP_V4},
    },
    {
        "branch": "feat/vehicles-endpoint",
        "title": "feat(vehicles): add vehicle service and REST endpoints",
        "summary": "Adds the vehicle service with CRUD operations and business logic, plus the /api/vehicles REST endpoints.",
        "base": "feat/auth-endpoint",
        "checkout_files": ["src/services/vehicle-service.ts", "src/routes/vehicles.ts"],
        "delete_files": [],
        "write_files": {"src/app.ts": APP_V5},
    },
    {
        "branch": "feat/devices-endpoint",
        "title": "feat(devices): add device service and REST endpoints",
        "summary": "Adds the device service for OBD device management and the /api/devices REST endpoints.",
        "base": "feat/vehicles-endpoint",
        "checkout_files": ["src/services/device-service.ts", "src/routes/devices.ts"],
        "delete_files": [],
        "write_files": {"src/app.ts": APP_V6},
    },
    {
        "branch": "feat/drivers-endpoint",
        "title": "feat(drivers): add driver service and REST endpoints",
        "summary": "Adds the driver service for driver profile management and the /api/drivers REST endpoints.",
        "base": "feat/devices-endpoint",
        "checkout_files": ["src/services/driver-service.ts", "src/routes/drivers.ts"],
        "delete_files": [],
        "write_files": {"src/app.ts": APP_V7},
    },
    {
        "branch": "feat/telemetry-and-websocket",
        "title": "feat(telemetry): add telemetry ingestion, trip service, and WebSocket server",
        "summary": "Implements the real-time telemetry pipeline: telemetry ingestion service with normalization, trip state machine, WebSocket server for live vehicle state broadcast, and the POST /api/telemetry endpoint.",
        "base": "feat/drivers-endpoint",
        "checkout_files": [
            "src/services/telemetry-service.ts", "src/services/trip-service.ts",
            "src/services/websocket-service.ts", "src/websocket/ws-server.ts",
            "src/routes/telemetry.ts",
        ],
        "delete_files": [],
        "write_files": {"src/app.ts": APP_V8, "src/server.ts": SERVER_V8},
    },
    {
        "branch": "feat/alerts-endpoint",
        "title": "feat(alerts): add alert rule engine, alert service, and REST endpoints",
        "summary": "Adds the alert rule engine with 7 threshold evaluations, the alert persistence service, and the /api/alerts REST endpoints.",
        "base": "feat/telemetry-and-websocket",
        "checkout_files": [
            "src/services/alert-rule-engine.ts", "src/services/alert-service.ts",
            "src/routes/alerts.ts",
        ],
        "delete_files": [],
        "write_files": {"src/app.ts": APP_V9},
    },
    {
        "branch": "feat/cron-stale-check",
        "title": "feat(cron): add stale device background check job",
        "summary": "Adds a node-cron background job that periodically checks for stale/disconnected OBD devices and updates their status.",
        "base": "feat/alerts-endpoint",
        "checkout_files": ["src/services/stale-check-job.ts"],
        "delete_files": [],
        "write_files": {"src/server.ts": SERVER_FINAL},
    },
    {
        "branch": "docs/openapi-swagger",
        "title": "docs(api): add OpenAPI specification and Swagger UI",
        "summary": "Adds the complete OpenAPI 3.0 specification for all endpoints and wires up Swagger UI at /api/docs.",
        "base": "feat/cron-stale-check",
        "checkout_files": ["src/docs/openapi.yaml"],
        "delete_files": [],
        "write_files": {"src/app.ts": APP_FINAL},
    },
    {
        "branch": "test/unit-tests",
        "title": "test: add unit tests for telemetry, trip, and alert services",
        "summary": "Adds comprehensive unit tests covering the telemetry ingestion service, trip state machine, and alert rule engine with test fixtures.",
        "base": "docs/openapi-swagger",
        "checkout_files": [
            "tests/unit/services/alert-rule-engine.test.ts",
            "tests/unit/services/telemetry-service.test.ts",
            "tests/unit/services/trip-service.test.ts",
            "tests/fixtures/telemetryPayload.ts",
        ],
        "delete_files": [],
        "write_files": {},
    },
    {
        "branch": "docs/project-documentation",
        "title": "docs: add project documentation, MkDocs config, and skill files",
        "summary": "Adds comprehensive project documentation including authentication feature docs, development guide, backend spec, getting-started guides, MkDocs configuration, and Antigravity skill definitions.",
        "base": "test/unit-tests",
        "checkout_files": [
            "docs/AUTHENTICATION_FEATURE.md", "docs/DEVELOPMENT.md",
            "docs/FuelGuard_Backend_Spec.md", "docs/index.md",
            "docs/getting-started/installation.md", "docs/getting-started/local-setup.md",
            "mkdocs.yml",
            ".antigravity/api-design.SKILL.md", ".antigravity/api-design.skill",
            ".antigravity/code-structure.SKILL.md", ".antigravity/code-structure.skill",
            ".antigravity/conflict-detection.SKILL.md", ".antigravity/conflict-detection.skill",
            ".antigravity/documentation-sync.SKILL.md", ".antigravity/documentation-sync.skill",
            ".antigravity/naming-conventions.SKILL.md", ".antigravity/naming-conventions.skill",
            ".antigravity/pr-decomposition.SKILL.md", ".antigravity/pr-decomposition.skill",
            ".antigravity/pr-presentation.SKILL.md", ".antigravity/pr-presentation.skill",
            ".antigravity/testing-standards.SKILL.md", ".antigravity/testing-standards.skill",
        ],
        "delete_files": [],
        "write_files": {},
    },
]

# ── Step 3: Create new branches ──────────────────────────────────────────
print(f"\n=== Creating {len(PRs)} new branches ===")
for i, pr in enumerate(PRs):
    branch = pr["branch"]
    base = pr["base"]
    print(f"\n--- PR {i+1}: {branch} (base: {base}) ---")

    run_ok(f"git checkout {base}")
    run_ok(f"git checkout -b {branch}")

    # Checkout files from backup
    for f in pr["checkout_files"]:
        run_ok(f"git checkout {BACKUP} -- {f}")

    # Delete files
    for f in pr["delete_files"]:
        if os.path.exists(f):
            run_ok(f"git rm {f}")

    # Write custom files (intermediate app.ts / server.ts versions)
    for filepath, content in pr["write_files"].items():
        if DRY_RUN:
            print(f"  DRY-RUN: write {filepath}")
        else:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, "w") as fh:
                fh.write(content)
        run_ok(f"git add {filepath}")

    # Write PR_DETAILS.md
    base_label = base if base == "main" else f"#{i}"
    if DRY_RUN:
        print("  DRY-RUN: write PR_DETAILS.md")
    else:
        with open("PR_DETAILS.md", "w") as fh:
            fh.write(f"# PR Details\n\n")
            fh.write(f"**Title:** {pr['title']}\n")
            fh.write(f"**Base Branch:** {base}\n\n")
            fh.write(f"## Summary\n\n{pr['summary']}\n")
    run_ok("git add PR_DETAILS.md")

    # Stage everything and commit
    run_ok("git add -A")
    run_ok(f'git commit -m "{pr["title"]}"')

    # Show diff stats for this PR vs its base
    stat = run_ok(f"git diff --shortstat {base} {branch}")
    print(f"  Stats vs {base}: {stat.stdout.strip()}")

print("\n=== All branches created! ===")
print("\nBranch summary:")
for i, pr in enumerate(PRs):
    stat = run_ok(f"git diff --shortstat {pr['base']} {pr['branch']}")
    print(f"  PR{i+1:2d} {pr['branch']:40s} {stat.stdout.strip()}")
