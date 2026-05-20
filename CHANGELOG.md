# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Created foundational Prisma schema and models for `Vehicle`, `Telemetry`, `Alerts`, and Authentication (`UserProfile`, `UserVehicleAccess`, `DeviceCredential`, `AdminUser`).
- Added `POST /api/auth/login` endpoint for Admin JWT generation based on `admin_users` table credentials.
- Added Express `app.ts` with routing, `errorHandler`, and `notFoundHandler`.
- Added authentication middleware components (`requireRole`, `resolveProfile`) leveraging Supabase Auth principles.

### Changed
- Switched ORM specification to Prisma from Supabase JS Client for the Node backend.
- Migrated primary environment variables and startup logic to use `zod` for configuration validation.

### Fixed
- (nothing)

### Deprecated
- (nothing)

### Removed
- (nothing)
