# SEVA MAINTENANCE MANAGEMENT SYSTEM — IMPLEMENTATION PLAN

## Overview
This document outlines the phased milestone plan for building the Seva Maintenance Management System: a self-hosted, zero-recurring-cost, production-ready, fully Dockerized full-stack TypeScript application (Next.js 15 App Router, PostgreSQL 16, Prisma ORM, Tailwind CSS, Lucide icons).

---

## Milestones

### Milestone 1: Foundation & Tooling Setup
- Initialize package.json, TypeScript (`tsconfig.json` with strict mode, `noUncheckedIndexedAccess`), Tailwind CSS, PostCSS, ESLint, Prettier, Vitest, Fast-Check.
- Configure Next.js 15 App Router (`output: "standalone"`), bundled local font, PWA manifest, and service worker.
- Build `src/core/config.ts` (Zod environment schema, fail-fast validation).
- Build `src/core/logger.ts` (pino structured logging with request IDs).
- Build `src/core/db.ts` (Prisma client singleton).
- Initialize `docs/PLAN.md`, `docs/DECISIONS.md`, and `docs/LICENSES.md`.
- **Validation**: Project builds, types check, linter runs cleanly.

### Milestone 2: Data Model, Prisma Schema & Database Seeder
- Implement `prisma/schema.prisma` with all required modules:
  - Users, Roles, RolePermissions, UserPermissionOverrides, Sessions
  - Categories, Areas (hierarchical tree), Tags
  - Seva (with materialized path `/rootId/parentId/id/`, depth 0-12, sortOrder, version, kind, subKind, etc.)
  - SevaAssignee, SevaWatcher, SevaTag, RecurrenceRule, ChecklistItem, Occurrence, OccurrenceChecklist, SevaTemplate
  - FileObject, SevaFile (quotes & artefacts buckets with partial unique approved index), FileLink
  - Comments, ActivityLog (append-only), Notification, Reminder, SevaRequest, Setting
- Write `prisma/seed.ts`:
  - Default Admin account, System Roles (ADMIN, COORDINATOR, MEMBER), Role Permissions
  - Default Categories (AC, Flooring, Landscaping, Networking, Others), Areas, System Settings
  - Demo dataset when `SEED_DEMO=true` (Coordinator, 3 Members, Mount Gambier Temple hierarchy, recurring tasks, checklist items, quotes, artefacts, comments).
- **Validation**: Prisma schema validates, compiles client, migrations and seeds run cleanly.

### Milestone 3: Authentication, Capability-Based Authorization & Core Security
- Implement argon2id password hashing (with bcrypt fallback), password complexity & common-password blacklist check.
- Server-side revocable session manager: cryptographically secure 256-bit token in `httpOnly`, `SameSite=Lax` cookie, SHA-256 token hash in DB, session rotation, idle (12h) & absolute (7d) expiration, single and bulk revocation.
- Database-backed login rate limiter & account lockout (5 attempts/min, lock after 10 failures).
- Capability-based authorization library: `can(user, permissionKey, context)` and `requirePermission()`.
- HTTP middleware & API wrappers: `withAuth()`, `validate()`, CSRF checks (SameSite, Origin, Sec-Fetch-Site), security headers (strict CSP, frame-ancestors 'none', nosniff, etc.).
- Append-only activity & audit logging service.
- **Validation**: Auth unit tests & permission evaluation tests pass.

### Milestone 4: Storage Service, File Pipeline & Export Engine
- Local disk storage abstraction (`src/core/storage/`) saving files under `./data/uploads/` with immutable ID-based paths (`data/uploads/seva/<SEV-CODE>/quotes/` and `artefacts/`).
- Upload processing pipeline: MIME & magic-byte sniffing (`file-type`), sharp image re-encoding (EXIF/GPS stripping, WebP thumbnails generation), SHA-256 hashing, size limit enforcement.
- Authenticated file download handler supporting HTTP Range requests (for video streaming) and sandbox headers.
- ZIP export engine (`archiver`) generating hierarchical archives with sanitized names and per-file permission checks.
- Export engine (`src/core/export/`): generic table definition to PDF (`pdfkit`), Excel (`exceljs`), and CSV.
- **Validation**: File pipeline tests, zip builder tests, and export formatting tests pass.

### Milestone 5: Domain Logic (Hierarchy, Recurrence, Business Rules & KPIs)
- Module Registry (`src/modules/registry.ts`) and modular monolith architecture.
- Seva Hierarchy Service:
  - Materialized path management, cycle detection, depth limits (<= 6 default, max 12).
  - Atomic subtree movement with optimistic locking.
  - Server-side recursive roll-up (occurrence counts, progress %, budget, dates, status).
- Recurrence Engine:
  - Daily, weekly, monthly (day of month, set position), quarterly, yearly, every N days.
  - FIXED vs FLOATING schedule modes.
  - Idempotent occurrence generation for the next 90 days (`recurrenceHorizonDays`).
- Property-based tests (`fast-check`) for recurrence rules and hierarchy materialized paths.
- Status transition workflow: PENDING -> IN_PROGRESS -> NEEDS_VERIFICATION -> DONE / SKIPPED / CANCELLED with optimistic locking.
- KPI calculation engine (`src/modules/dashboard/kpi.ts`): completion %, on-time %, budget vs spend, chart datasets.
- Quotes management: approval partial unique index enforcement, auto-updating seva approved budget.
- **Validation**: Vitest tests and fast-check property tests pass.

### Milestone 6: Complete REST API & OpenAPI Documentation
- Build all `/api/v1/` route handlers:
  - `/api/v1/auth/*`: login, logout, logout-all, change-password, me
  - `/api/v1/users/*`: CRUD, reset password, activate/deactivate, role assignment
  - `/api/v1/masters/*`: categories, areas tree, tags
  - `/api/v1/seva/*`: CRUD, tree, move, duplicate, archive/unarchive, rollup, assignees, watchers, bulk operations
  - `/api/v1/occurrences/*`: list, status update, checklist toggle, upcoming
  - `/api/v1/files/*`: uploads, downloads, thumbnails, metadata patch, move bucket, approve/revoke quote, compare quotes, zip download, tree, usage
  - `/api/v1/comments/*`: CRUD with 10-minute edit window
  - `/api/v1/requests/*`: submit, list, convert to seva
  - `/api/v1/notifications/*`: list, mark read
  - `/api/v1/settings/*`: list, update
  - `/api/v1/audit/*`: query logs
  - `/api/v1/dashboard/*`: KPIs, charts
  - `/api/v1/reports/*`: preview, export (pdf, xlsx, csv)
  - `/api/v1/search`: global search across modules
  - `/api/health`, `/api/ready`
- Generate OpenAPI specification from shared Zod schemas served at `/api/docs`.
- **Validation**: API route tests and schema contract tests pass.

### Milestone 7: UI Kit, Layout & Global Shell
- Responsive, mobile-first app layout with desktop sidebar, phone sticky bottom nav, quick search, notification bell, theme toggle.
- Bundled UI Kit components (`src/core/ui-kit/`):
  - DataTable, FormField, FileUploader, FileTree, FilterBar, StatCard, TreeView, EmptyState, ConfirmDialog, Modal, Badge, Button, Tabs, Skeleton.
- Installable PWA setup: `manifest.webmanifest`, app icons, local service worker.
- **Validation**: Components render cleanly, responsive layout verified.

### Milestone 8: Full Frontend Screens Implementation
- Implement all 14 screens without placeholders or mock data:
  1. Login & Forced Password Change
  2. Dashboard (KPI cards, filters, charts, Needs Attention, Due Soon, Recent Activity, My Seva strip)
  3. Seva Sheet (Table, Tree with expand/collapse and roll-up progress, Calendar, Board views; search, saved views, CSV export)
  4. My Seva (Overdue, Today, This Week, Later, Completed Recently with quick actions)
  5. Upcoming Seva (7, 30, 90 days grouped by day)
  6. Seva Detail (Breadcrumbs, chips, schedule, assignees, watchers, checklist, history, Files tab with Quotes & Artefacts, Sub-seva tab with roll-up for groups, comments with @mentions, activity timeline)
  7. Quotes Panel & Compare Quotes view
  8. File Library (Global folder tree mirroring seva hierarchy)
  9. Seva Requests (Submit, review, convert)
  10. Notifications Center
  11. Reports (Filter, preview, Project roll-up report, PDF/Excel/CSV exports)
  12. Admin Console (Users, Roles, Categories, Area Tree Editor, Tags, Templates, Settings, Storage Usage, Backup Info)
  13. Create & Edit Seva Modal/Form (Tree parent picker, recurrence builder & preview, assignees with lead, checklist builder, file uploads)
  14. Profile (Password change, sign out all devices, notification preferences).
- **Validation**: Frontend builds cleanly, type-checks with zero errors.

### Milestone 9: Worker Daemon & Scheduled Jobs
- Implement standalone worker (`src/worker/index.ts`) driven by `node-cron`.
- PostgreSQL advisory locks ensuring single execution across instances:
  - Nightly occurrence generation (02:00 org time)
  - Hourly overdue check and notification dispatch
  - Daily 08:00 digest dispatch
  - Reminder dispatcher
  - Weekly orphaned-file cleanup
- **Validation**: Worker job tests pass.

### Milestone 10: Extensibility & Module Scaffold Generator
- Create `src/modules/_template/` module scaffold.
- Implement `scripts/new-module.ts` invoked via `npm run new:module -- <name>`.
- Feature flag support (`module.<id>.enabled`) dynamically toggling routes and nav items.
- Write `docs/MODULES.md` with complete guide and example.
- **Validation**: Module scaffold test creates a new module, verifies registration, and tests clean removal.

### Milestone 11: Security Verification Suite & Quality Assurance
- Automated security test suite (`tests/security/`):
  - Full authorization matrix (anonymous, deactivated, member, coordinator, admin)
  - SQL injection & XSS payload testing
  - Path traversal and malicious file upload tests
  - CSRF protection from external origins
  - Brute-force throttling & lockout
  - Session fixation, rotation, and revocation
  - IDOR resistance on all entity routes
- Property-based testing with `fast-check` and end-to-end smoke test script.
- **Validation**: All security and quality tests pass.

### Milestone 12: Dockerization, Deployment & Documentation
- Multi-stage `Dockerfile` (`node:20-alpine`, non-root user, Next.js standalone output).
- `docker-compose.yml` (db, app, worker) & `docker-compose.dev.yml`.
- Profiles: `https` (Caddy) and `antivirus` (ClamAV).
- Operational scripts: `scripts/entrypoint.sh`, `scripts/backup.sh`, `scripts/restore.sh`, `scripts/smoke-test.sh`.
- `Makefile` covering all targets: `up`, `down`, `logs`, `build`, `dev`, `migrate`, `seed`, `backup`, `restore`, `test`, `lint`, `security`, `smoke`, `ci`.
- Complete documentation suite: `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, `docs/API.md`, `docs/DEPLOY.md`, `README.md`.
- **Validation**: Full stack runs in Docker, smoke test succeeds, security suite succeeds.
