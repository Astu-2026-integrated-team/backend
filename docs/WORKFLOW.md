# Backend Workflow

## Purpose

This document defines how the backend repository should be operated day to day.

## Working Model

Keep changes small, reviewable, and testable.

Good examples:

- one PR for a new endpoint
- one PR for a schema or environment change
- one PR for AI helper tooling

Bad examples:

- one PR mixing API changes, docs rewrites, and unrelated tooling cleanup

## Branching

Use short-lived branches:

```text
feat/<topic>
fix/<topic>
docs/<topic>
chore/<topic>
test/<topic>
```

See `docs/BRANCHING_STRATEGIES.md` for branch, commit, and PR rules for backend work.

## Review Rule

Every PR should state:

- what changed
- why it changed
- how it was tested
- what remains as follow-up

Preferred review target:

- under 300 changed lines
- 10 changed files or fewer

## CI Strategy

This repo now has a minimal CI workflow.

Current CI runs:

- repo sanity and deploy-readiness checks
- Python lint with Ruff
- Python tests with Pytest
- Node TypeScript checks and Jest tests
- checked-in OpenAPI contract validation for FastAPI and Express
- smoke checks for documented endpoints
- Postgres-backed integration checks for database-sensitive paths

Keep CI fast by keeping the default path deterministic and using a small seeded Postgres service for integration coverage.

## CD Status

Continuous deployment is not set up yet.

When deployment starts, prefer:

- CI on every pull request
- deployment only from `main`
- staging before production
- environment secrets managed in GitHub or the deployment platform, not in the repo
