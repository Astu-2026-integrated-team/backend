# CI Guide

## Purpose

This document explains what the backend CI workflow enforces, what GitHub configuration is needed, and how to interpret passing checks.

## Workflow Overview

The backend CI workflow lives in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

It runs on:

- every pull request
- every push to `main`

The workflow is split into these jobs:

- `repo_sanity`
- `python_quality`
- `node_quality`
- `openapi_contract`
- `endpoint_smoke`
- `endpoint_integration_db`
- `deployment_readiness`

## What CI Checks

### Repo and deployment readiness

`repo_sanity` and `deployment_readiness` verify:

- required repo files exist
- `.env.example` contains the expected keys
- `render.yaml` includes the expected deploy env vars
- the Docker build remains valid
- documented build and start commands still match the repo

### Python quality

`python_quality` verifies:

- Python dependencies install
- Ruff passes
- Python tests pass
- the FastAPI app imports successfully

### Node quality

`node_quality` verifies:

- Node dependencies install
- Prisma client generation works
- TypeScript checks pass
- Jest tests pass
- the Express app imports successfully

### OpenAPI and Swagger coverage

`openapi_contract` verifies the checked-in API contracts.

FastAPI contract source:

- [`openapi/fastapi.json`](../openapi/fastapi.json)

Express contract source:

- [`openapi/express.json`](../openapi/express.json)

Validation behavior:

- FastAPI generates `app.openapi()` at runtime and compares it to the checked-in contract
- Express compares the registered route definitions in [`src/contracts/express-routes.ts`](../src/contracts/express-routes.ts) to the checked-in contract

This catches:

- new endpoints missing from the checked-in contract
- endpoints documented in the contract but no longer present
- response status code drift

### Endpoint smoke checks

`endpoint_smoke` verifies the documented endpoints can be exercised successfully in a fast CI path.

Current FastAPI smoke checks cover:

- `GET /health`
- OpenAPI route visibility

Current Express smoke checks cover:

- `GET /health`
- not found behavior
- health behavior with and without Prisma connectivity

### Database-backed endpoint checks

`endpoint_integration_db` starts an ephemeral Postgres service inside GitHub Actions.

It then:

- seeds the telemetry table with [`scripts/bootstrap-ci-db.py`](../scripts/bootstrap-ci-db.py)
- runs the FastAPI telemetry integration test
- runs the Express Postgres-aware health test

This catches:

- startup or DB connection regressions
- telemetry endpoint regressions
- Prisma-backed health connectivity regressions

## What CI Does Not Guarantee

CI is stricter than before, but it does not automatically prove every possible behavior for every future endpoint.

Important limits:

- a new endpoint still needs a test case added for its behavior
- the OpenAPI check proves the endpoint is documented, not that every business rule is fully covered
- Express contract enforcement is strongest when public routes are added through [`src/contracts/express-routes.ts`](../src/contracts/express-routes.ts)

Team rule:

- any new public Express endpoint should be declared through the shared route definition flow
- any new public FastAPI endpoint should remain visible in generated OpenAPI
- any new endpoint should ship with at least one smoke or integration test

## Public Repo Guidance

Do not hardcode real secrets in the workflow.

The workflow may use CI-only dummy values for non-production bootstrapping, but real runtime or deploy secrets must never live in the repository.

Recommended approach:

- keep non-sensitive test toggles inline
- keep deploy or credential-like values in GitHub repository secrets or the deploy platform

Safe inline examples:

- `APP_ENV=development`
- `CI_POSTGRES_INTEGRATION=1`

Secret-shaped values that should come from GitHub Secrets for long-term use:

- `SUPABASE_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `AUTH_DEVICE_TOKEN_PEPPER`
- `OPENAI_API_KEY` when needed

## GitHub Setup

### Required repository features

Enable:

- Actions
- Pull requests

### Branch protection

Protect `main` and require all CI checks to pass before merge.

Recommended required checks:

- `repo_sanity`
- `python_quality`
- `node_quality`
- `openapi_contract`
- `endpoint_smoke`
- `endpoint_integration_db`
- `deployment_readiness`

If the workflow job names change, update branch protection to match.

### Repository secrets

For the current workflow, PR CI can run without adding production secrets because the workflow uses CI-safe values and an ephemeral Postgres service.

For a stricter public-repo setup, prefer repository secrets for any credential-like values used in CI. Suggested CI secrets:

- `CI_SUPABASE_DB_URL`
- `CI_SUPABASE_URL`
- `CI_SUPABASE_ANON_KEY`
- `CI_SUPABASE_JWT_SECRET`
- `CI_AUTH_DEVICE_TOKEN_PEPPER`

These should be test-only values, not production credentials.

## How To See CI Passing

### On GitHub

1. Push the branch.
2. Open a pull request.
3. Open the Actions tab or the PR checks section.
4. Confirm each CI job passes.

Passing means:

- the apps build
- lint passes
- tests pass
- contracts match runtime routes
- smoke checks pass
- DB-backed checks pass
- deploy-readiness checks pass

### Locally

Helpful local commands:

```bash
make check
./.venv/bin/python scripts/check-fastapi-app.py
./.venv/bin/python scripts/validate-fastapi-openapi.py
npm run lint:node
npm run test:node
```

To run the DB-backed checks locally, start a local Postgres instance and use:

```bash
export APP_ENV=development
export CI_POSTGRES_INTEGRATION=1
export SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
./.venv/bin/python scripts/bootstrap-ci-db.py
./.venv/bin/pytest tests/test_telemetry_integration.py
npm run test -- src/__tests__/app-postgres.test.ts --runInBand
```

## When Adding a New Endpoint

Before opening the PR:

1. Add the route implementation.
2. Add or update the checked-in OpenAPI contract.
3. Add the endpoint test.
4. Run the relevant local checks.

For FastAPI:

- make sure the endpoint appears in generated OpenAPI
- update [`openapi/fastapi.json`](../openapi/fastapi.json)

For Express:

- add the endpoint through [`src/contracts/express-routes.ts`](../src/contracts/express-routes.ts) or the same shared route-definition pattern
- update [`openapi/express.json`](../openapi/express.json)

If any of those steps are missed, CI should fail.
