# Phase 2 Contractors Module: Implementation Plan & Baseline

## 1. Baseline Test Execution Results

Executed on 2026-10-27 before making any module additions:

| Test Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Unit & Integration Tests** | `npm test` (vitest run) | **PASS** | 7 test files passed, 41 tests passed |
| **Security Tests** | `npm run test:security` | **PASS** | 4 test files passed, 29 tests passed |
| **Type Check** | `npm run typecheck` | **PASS** | 0 TypeScript errors |
| **Linter** | `npm run lint` | **PASS** | 0 errors (standard warnings only) |
| **Smoke Tests** | `bash scripts/smoke-test.sh` | **PASS** | 12/12 end-to-end integration paths verified |

---

## 2. Post-Implementation Verification Results (Phase 2 Contractors Complete)

Executed on 2026-10-27 after full implementation and Docker container rebuild:

| Test Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Full Test Suite** | `npm test` (vitest run) | **PASS** | **11 test files passed, 77/77 tests passed (100%)** |
| **Security Tests** | `npm run test:security` | **PASS** | **5 test files passed, 38/38 tests passed (100%)** |
| **Type Check** | `npm run typecheck` | **PASS** | **0 TypeScript errors (`tsc --noEmit`)** |
| **Linter** | `npm run lint` | **PASS** | **0 errors across all routes & components** |
| **Comprehensive Smoke Tests** | `bash scripts/smoke-test.sh` | **PASS** | **13/13 end-to-end paths verified including Contractors Directory, Field-Tier stripping, Request submission & approval, CSV export** |
| **Live Browser Verification** | Antigravity Browser Agent | **PASS** | **Directory, cards, detail tabs, credential health, quick actions, review queue verified** |

---

## 2. Implementation Milestones

### Milestone 1: Database Schema & Migrations
- Add `// === MODULE: contractors ===` section to `prisma/schema.prisma`.
- Models: `Contractor`, `Trade`, `ContractorTrade`, `CategoryTrade`, `ContractorContact`, `ContractorCredential`, `ContractorReview`, `SevaContractor`, `ContractorRequest`, `ContractorTag`.
- Additive modification to `SevaFile`: add nullable `contractorId` foreign key and relation.
- Enums: `ContractorStatus`, `RegistrationType`, `CredentialKind`, `CredentialStatus`, `SevaContractorRole`, `SevaContractorStatus`, `ContractorRequestType`, `ContractorRequestStatus`.
- Trigram indexes and compound unique constraints.
- Seed data extension in `prisma/seed.ts` (16 Trades, CategoryTrade mappings, 8 Demo Contractors, credentials, contacts, reviews, requests, quote links).
- Verify database migration on clean DB and demo DB.

### Milestone 2: Module Scaffolding, Registry & Capabilities
- Run `npm run new:module -- contractors`.
- Register permission keys in `src/core/permissions/keys.ts` and manifest:
  - `contractors.read`, `contractors.readFull`, `contractors.request`, `contractors.requests.review`, `contractors.write`, `contractors.credentials.view`, `contractors.credentials.manage`, `contractors.documents.view`, `contractors.documents.manage`, `contractors.reviews.write`, `contractors.assign`, `contractors.import`, `contractors.manage`.
- Configure default permission grants for `ADMIN`, `COORDINATOR`, and `MEMBER`.
- Register module in `src/modules/registry.ts` with feature flag `module.contractors.enabled`.
- Implement field-tier stripping engine (`stripContractorTiers` / `sanitizeContractorResponse`) in `src/modules/contractors/tiers.ts`.
- Implement ABN checksum and format validator with property tests.

### Milestone 3: Domain Services & Storage Pipeline
- `ContractorService`: CRUD, optimistic concurrency (`version`), archive/unarchive, block/unblock, near-duplicate detection (>0.6 trigram).
- `ContractorContactService`: CRUD with atomic single-primary enforcement.
- `ContractorCredentialService`: CRUD, verification, status calculation (`VALID`, `EXPIRING_SOON`, `EXPIRED`).
- `ContractorReviewService`: CRUD, 24h edit window, soft-delete, server-side average calculations.
- `ContractorRequestService`: Submit, user quota enforcement (5 open, 10/day), side-by-side diff generation, atomic approval with conflict detection, rejection with reason, withdrawal.
- `SevaContractorService`: Link contractor to Seva, status transitions, quote link synchronization, blocked/expired warning checks.
- Document storage driver: ID-based disk structure `data/uploads/contractors/CON-XXXX/...` and request uploads `data/uploads/contractor-requests/CRQ-XXXX/...`. Audit logging on credential document views. ZIP download stream.

### Milestone 4: API Handlers (/api/v1/contractors, etc.)
- Handlers wrapped with `withAuth()` and feature flag checks:
  - `/api/v1/contractors`: List, Create, Detail, Update, Archive, Block/Unblock, Duplicates.
  - `/api/v1/contractors/[id]/contacts`, `.../credentials`, `.../reviews`, `.../files`, `.../jobs`, `.../quotes`, `.../spend`.
  - `/api/v1/contractor-requests`: List, Create, Mine, Detail with Diff, Approve, Reject, More-Info, Withdraw, Files.
  - `/api/v1/trades` & `/api/v1/category-trades`.
  - `/api/v1/contractors/import/preview` & `/commit`.
  - `/api/v1/contractors/export` (CSV, XLSX, PDF) with formula-injection neutralization.
  - `/api/v1/seva/[id]/contractors` & `/suggestions`.
  - Global search integration.

### Milestone 5: UI Components & Responsive Screens
- Mobile-first, Tailwind CSS, dark & light mode, accessible UI.
- `ContractorDirectoryPage` (`/contractors`): Desktop table, mobile cards, search, filters, tap-to-call/email, BLOCKED warning badge.
- `ContractorDetailPage` (`/contractors/[id]`): Overview, Contacts, Credentials, Documents (FileTree / Explorer), Jobs & Quotes & Spend, Reviews, Activity & Notes.
- Forms: Add/Edit contractor, Suggest contractor, Suggest change.
- Requests Queue: Side-by-side diff comparison, per-field checkbox acceptance.
- Admin screens: Trades & Category mapping, CSV Import with preview and column mapper, Link existing quotes tool.
- Seva detail integration: Contractors tab & panel, quote linking picker.
- Dashboard widgets: Expiring credentials, spend by contractor, open requests.

### Milestone 6: Worker Jobs & Automated Tasks
- `refreshCredentialStatus`: Daily status transition recalculation.
- `scheduleCredentialReminders`: Deduplicated reminders at 60, 30, 7, 0 days.
- `remindStaleRequests`: Reviewer notification for requests OPEN > 7 days.
- System notification triggers for block/unblock, assignment, review, request events.

### Milestone 7: Testing & Verification
- Unit & property tests (ABN validation, CSV normalization, rate limiting).
- Security test suite: Authorization matrix, member field-tier stripping proof, IDOR, SQLi/XSS, formula injection, file upload safety.
- E2E Playwright tests on mobile (375px) and desktop.
- End-to-end smoke test execution.

### Milestone 8: Documentation & Final Reporting
- Update `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/DATA_MODEL.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`, `docs/LICENSES.md`.
- Create `docs/CONTRACTORS.md` comprehensive user guide.
- Generate final delivery report.
