# Phase 2 Licences and Skills Module: Implementation Plan & Baseline

## 1. Baseline Test Execution Results

Executed on 2026-10-27 before making any module additions:

| Test Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Unit & Integration Tests** | `npm test` (vitest run) | **PASS** | 11 test files passed, 77 tests passed (100%) |
| **Security Tests** | `npm run test:security` | **PASS** | 5 test files passed, 38 tests passed (100%) |
| **Type Check** | `npm run typecheck` | **PASS** | 0 TypeScript errors (`tsc --noEmit`) |
| **Linter** | `npm run lint` | **PASS** | 0 errors across all routes & components |
| **Comprehensive Smoke Tests** | `bash scripts/smoke-test.sh` | **PASS** | 13/13 end-to-end integration paths verified |

---

## 2. Implementation Milestones

### Milestone 1: Database Schema & Migrations
- Add `// === MODULE: licences ===` section to `prisma/schema.prisma`.
- Entities:
  - `LicenceCategory`: Category taxonomy (`name`, `sortOrder`).
  - `LicenceType`: Master definitions (`code`, `name`, `categoryId`, `kind`, `issuer`, `aliases`, `classes`, `hasExpiry`, `defaultValidityMonths`, `requiresNumber`, `isHighlySensitive`, `minHoldersTarget`, `description`, `isActive`, `sortOrder`).
  - `UserLicence`: Member records (`userId`, `licenceTypeId`, `class`, `licenceNumber`, `issuer`, `issuedAt`, `expiresAt`, `conditions`, `notes`, `status`, `source`, `verifiedById`, `verifiedAt`, `rejectionReason`, `supersededById`, `archivedAt`, `version`).
  - `UserAvailability`: Member availability (`userId`, `status`, `note`, `availableUntil`).
  - `SevaRequiredLicence`: Seva task requirements (`sevaId`, `licenceTypeId`, `classRequired`, `minHolders`).
  - `LicenceCountSnapshot`: Weekly metrics snapshot (`takenOn`, `licenceTypeId`, `validHolders`, `expiringSoon`, `expired`, `pending`).
- Enums: `LicenceKind`, `UserLicenceStatus`, `UserLicenceSource`, `UserAvailabilityStatus`, `LicenceFileKind`.
- Partial unique indexes:
  - `UserLicence(userId, licenceTypeId, class)` where `archivedAt IS NULL AND supersededById IS NULL`.
  - `UserAvailability(userId)` unique.
  - `SevaRequiredLicence(sevaId, licenceTypeId, classRequired)` unique.
  - `LicenceCountSnapshot(takenOn, licenceTypeId)` unique.
- Seed data extension:
  - Categories: Plant and Equipment, Working at Heights, Electrical and Trades, First Aid and Safety, Driving and Transport, Site Induction, Compliance and Checks, Other.
  - Seed LicenceTypes (Forklift, EWP, White Card, First Aid, CPR, Working at Heights, Confined Space, Electrical, Dogging/Rigging, Crane, Fire Warden, Chemical, Driver licence [highly sensitive], WWCC [highly sensitive], Police Check [highly sensitive]).
  - Seed demo UserLicence records across 10 users, availability variety, required licences on demo seva, weekly snapshots for last 12 weeks.

### Milestone 2: Scaffolding, Registry, Capabilities & Field Tiers
- Scaffolding via `scripts/new-module.ts -- licences`.
- 12 Permission keys in `src/core/permissions/keys.ts` and manifest:
  - `licences.own.view`, `licences.own.submit`, `licences.directory.view`, `licences.directory.contact`, `licences.manage`, `licences.verify`, `licences.sensitive.view`, `licences.documents.view`, `licences.types.manage`, `licences.seva.require`, `licences.reports.view`, `licences.import`.
- Default grants:
  - `MEMBER`: `licences.own.view`, `licences.own.submit` (default settings: `membersCanSubmitOwnLicences: true`, `membersCanViewLicenceDirectory: false`).
  - `COORDINATOR`: Member keys + `licences.directory.view`, `licences.directory.contact`, `licences.seva.require`, `licences.reports.view`.
  - `ADMIN`: All keys.
- Module Manifest & Registry registration (`module.licences.enabled`, default true).
- Field-tier stripping engine in `src/modules/licences/tiers.ts`:
  - Directory tier: name, avatar, licence type, class, status badge, expiry month/year, availability.
  - Contact tier: phone, email.
  - Sensitive tier: full licence number, exact dates, conditions, notes. Default masked (`••••• 482`) with audited Reveal endpoint.
  - Documents tier: file scans.
  - Highly sensitive types (`isHighlySensitive = true`): visible only to holder and users with both `sensitive.view` and `documents.view`. Excluded from bulk exports, ZIPs, and directory views beyond status badge.

### Milestone 3: Domain Services & Holder Logic
- Shared holder definition function: `isLicenceHolder(licence, onDate?, includePending?)`. Active user, non-superseded, non-archived, verified, VALID or EXPIRING_SOON on date. User counts once per licence type.
- `LicenceTypeService`: Master taxonomy CRUD, aliases search.
- `UserLicenceService`: Self-service submission, renewal (atomic supersede + create new), verification/rejection, admin CRUD, optimistic locking.
- `AvailabilityService`: User and coordinator availability management, auto-revert support.
- `DirectoryService`: Advanced filtering (category, type, class, status, expiring window, availability, valid on date D, hasAll/hasAny).
- `VolunteerService`: Find volunteers ranked by requirements match, availability, least assigned upcoming tasks, longest remaining validity.
- `SevaLicenceService`: Required licences on seva, compliance evaluation, WARN vs BLOCK enforcement, daily upcoming task check.
- `LicenceReportsService`: Reports and exports (Holders by type, Expiry, Matrix, Gaps, Person licence sheet PDF, Seva compliance, Trends) with formula injection defense.
- `LicenceImportService`: Safe CSV import matching users by email.
- `LicenceStorageService`: ID-based folder storage `data/uploads/licences/userId/licenceId/` with audit logging on document view/download and number reveal.

### Milestone 4: API Handlers (/api/v1/licences, /licence-types, etc.)
- Thin route handlers with `withAuth({ permission })` and `ensureLicencesEnabled()`.
- Endpoints:
  - `/api/v1/licence-types`, `/api/v1/licence-categories`
  - `/api/v1/me/licences`, `/api/v1/me/licences/:id`, `/api/v1/me/licences/:id/renew`, `/api/v1/me/licences/:id/files`, `/api/v1/me/availability`
  - `/api/v1/users/:id/licences`, `/api/v1/licences/:id`, `/api/v1/licences/:id/verify`, `/api/v1/licences/:id/reject`, `/api/v1/licences/:id/renew`, `/api/v1/licences/:id/suspend`, `/api/v1/licences/:id/revoke`, `/api/v1/licences/:id/archive`, `/api/v1/licences/:id/reveal-number`, `/api/v1/licences/:id/files`
  - `/api/v1/licence-directory`, `/api/v1/licence-summary`, `/api/v1/licence-matrix`, `/api/v1/licence-trends`
  - `/api/v1/licence-find`
  - `/api/v1/seva/:id/required-licences`, `/api/v1/seva/:id/licence-check`
  - `/api/v1/licences/pending`
  - `/api/v1/licence-reports/preview`, `/api/v1/licence-reports/export`
  - `/api/v1/licences/import/preview`, `/api/v1/licences/import/commit`, `/api/v1/licences/import/template`
  - Global search integration.

### Milestone 5: UI Components & Responsive Screens
- Mobile-first, Tailwind CSS, dark & light mode, accessible UI.
- `/licences/my`: Self-service portal with status badges, expiry countdowns, Add Licence modal with camera/photo upload, Renew, Withdraw, and Availability switch.
- `/licences`: Searchable Directory with alias support ("EWP"), filter chips, mobile cards, desktop table, tap-to-call/email, Export.
- `/licences/summary`: Summary dashboard with cards per type, holder counts, progress bar towards minHoldersTarget, click-through to holder list.
- `/licences/find`: Find Volunteers tool with multi-licence requirements, date picker, availability rank, copy list, and Quick Assign.
- `/licences/matrix`: Grid matrix of users x licence types, status badges, category filters, CSV/Excel export.
- `/licences/verify`: Verification queue with side-by-side document preview, Verify, Reject, and Edit-then-verify.
- `/licences/types`: Admin master list management (types, categories, classes, targets, sensitivity).
- `/licences/import`: CSV import with column mapping and row error preview.
- `/users/[id]` Licences tab: User licence management with history of superseded records.
- Seva form & Seva Detail integration: Required licences section, assignee picker eligibility badges, Licence check banner on detail, WARN/BLOCK assignment modal.
- Dashboard widgets: Expiring in 30 days, types below target, pending verifications, quick volunteer lookup.

### Milestone 6: Worker Jobs & Automated Tasks
- `refreshLicenceStatus`: Daily at 02:45. Derived status calculation from expiresAt and auto-reversion of expired availability windows.
- `scheduleLicenceReminders`: Deduplicated Reminder rows at 60, 30, 7, 0 days before expiry.
- `licenceSnapshot`: Weekly snapshot calculation into `LicenceCountSnapshot`.
- `checkUpcomingSevaLicences`: Daily check of upcoming seva tasks to notify coordinators if an assignee's licence will lapse before task due date.

### Milestone 7: Verification & Testing
- Unit & property tests (`fast-check`): Status derivation across dates/timezones, holder definition on date D.
- Security tests: Complete authorization matrix, member data isolation proof, directory field-tier masking proof, highly sensitive type privacy, IDOR, Luhn defense, formula injection, path traversal, rate limiting.
- Integration tests against PostgreSQL container.
- End-to-end smoke test script extension.

### Milestone 8: Documentation & Final Reporting
- Update `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/DATA_MODEL.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`, `docs/LICENSES.md`.
- Create `docs/LICENCES.md` comprehensive user guide.
- Print final delivery report.

---

## 3. Final Test & Verification Results

Executed on 2026-10-27 following complete implementation of Phase 2:

| Test Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **All Automated Tests** | `npm test` | **PASS** | 15 test files passed, 127 tests passed (100%) |
| **Security Test Suite** | `npm run test:security` | **PASS** | 6 test files passed, 52 tests passed (100%) |
| **Type Check** | `npm run typecheck` | **PASS** | 0 TypeScript errors (`tsc --noEmit`) |
| **Linter** | `npm run lint` | **PASS** | 0 errors across all routes & components |
| **Production Build** | `npm run build` | **PASS** | Standalone Next.js 15 bundle, worker & seed bundles compiled |
| **Containerized Smoke Test** | `bash scripts/smoke-test.sh` | **PASS** | 14/14 sections verified (including Section 14: Licences & Skills) |

### Test Breakdown by Module Area

| Component / Service | File | Tests | Key Invariants Verified |
| :--- | :--- | :--- | :--- |
| **Canonical Holder Logic** | `tests/unit/licences/holder.test.ts` | 13 | Status transitions on date $D$, verified-only counting, single count across classes, property tests |
| **Data Tiers & Masking** | `tests/unit/licences/tiers.test.ts` | 14 | Directory/Contact/Sensitive/Documents tiers, `••••• 482` masking, highly sensitive isolation |
| **Licence Domain Service** | `tests/unit/licences/licence.service.test.ts` | 15 | Self-submission quotas, atomic renewal supersede, verify/reject/suspend/revoke/archive, reveal audit |
| **Volunteer Matcher** | `tests/unit/licences/volunteer.service.test.ts` | 8 | 4-stage ranking algorithm (qualifications > availability > workload > longevity) |
| **Formula & Luhn Defense** | `tests/unit/licences/schemas.test.ts` | 8 | Formula injection protection (`neutralizeFormula`), credit card Luhn rejection |
| **Seva Compliance** | `tests/unit/licences/seva.service.test.ts` | 6 | Evaluates requirements against assignee validity on seva target date |
| **Full Security Suite** | `tests/security/licences.security.test.ts` | 14 | Matrix enforcement across 12 keys, member data isolation, audited reveal, export formula safety |
| **Core Platform Suites** | `tests/unit/*`, `tests/security/*` | 49 | Seva hierarchy, occurrences, files, contractor privacy, rate limiting |
