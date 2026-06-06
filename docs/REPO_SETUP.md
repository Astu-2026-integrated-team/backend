# Repository Setup

## Purpose

This document defines the recommended GitHub configuration for `Astu-2026-integrated-team/backend`.

## Branch Protection

Protect `main` with these rules:

- require a pull request before merge
- require at least 1 approval
- dismiss stale approvals when new commits are pushed
- require conversation resolution before merge
- require status checks to pass before merge
- block direct pushes to `main`

## Required Status Checks

Require these checks from GitHub Actions:

- `repo_sanity`
- `python_quality`
- `node_quality`
- `openapi_contract`
- `endpoint_smoke`
- `endpoint_integration_db`
- `deployment_readiness`

If job names change in `.github/workflows/ci.yml`, update the branch protection rules to match.

## Suggested Labels

- `bug`
- `enhancement`
- `task`
- `docs`
- `ai`
- `api`
- `db`
- `blocked`
- `needs-review`

## Repository Features To Enable

- Issues
- Pull requests
- Actions
- Discussions only if the team wants design discussion in GitHub

## Secrets

Do not commit runtime secrets.

When deployment starts, store secrets in the deployment platform or GitHub repository secrets:

- `SUPABASE_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `AUTH_DEVICE_TOKEN_PEPPER`
- `OPENAI_API_KEY`

## First Admin Checklist

1. Confirm `main` is the default branch.
2. Enable the branch protection rules above.
3. Verify the CI job names above are required checks on `main`.
4. Add the suggested labels.
5. Confirm Actions are enabled for the repository.
