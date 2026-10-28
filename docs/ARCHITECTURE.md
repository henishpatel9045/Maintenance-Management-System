# Architecture Documentation: Seva Maintenance Management System

## 1. Executive Summary

The Seva Maintenance Management System is a complete, self-hosted, production-grade maintenance management platform. It is engineered with a **zero recurring cost, single-folder portable architecture** that runs entirely within Docker on the owner's hardware without cloud vendor lock-in.

---

## 2. System Architecture

```
                       +---------------------------------------+
                       |   Client Browser / Mobile PWA (App)   |
                       | (Next.js 15, Tailwind, TanStack Query)|
                       +-------------------+-------------------+
                                           | HTTP (LAN / HTTPS)
                                           v
+-----------------------------------------------------------------------------------------+
|                                    Docker Compose Network                               |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                         Next.js Standalone App Container                        |   |
|   |                                                                                 |   |
|   |  [Middleware: Security Headers, Nonce CSP, CSRF Origin & Sec-Fetch-Site Check]   |   |
|   |                                                                                 |   |
|   |  [Presentation Layer]           [REST API Handlers (/api/v1)]                   |   |
|   |  - Mobile PWA App Shell         - Zod Schema Validation                         |   |
|   |  - UI Kit Components            - Capability Check: can(user, perm, ctx)        |   |
|   |  - 14 Responsive Screens        - Thin Routing to Domain Services               |   |
|   |                                                                                 |   |
|   |  [Domain Services]                                                              |   |
|   |  - Seva Hierarchy & Roll-up     - Recurrence Calculation Engine                 |   |
|   |  - Quotes & Budget Tracking     - Export Engine (PDF, Excel, CSV)               |   |
|   |  - File Pipeline & Thumbnails   - KPI & Dashboard Metrics Calculation           |   |
|   |                                                                                 |   |
|   |  [Core Infrastructure]                                                          |   |
|   |  - Prisma ORM 5                 - Argon2id / Bcrypt Cost 12 Hashing             |   |
|   |  - Pino Structured Logger       - Local Disk Storage Driver (Path Traversal Def)|   |
|   +--------------------------+------------------------------+-----------------------+   |
|                              |                              |                           |
|                              v                              v                           |
|   +--------------------------------------+   +--------------------------------------+   |
|   |    PostgreSQL 16 Database Engine     |   |       Persistent Local Storage       |   |
|   |  - pg_trgm Trigram Indexes           |   |  - Bind Mount: ./data/uploads        |   |
|   |  - Materialized Path Hierarchy       |   |  - Bind Mount: ./data/postgres       |   |
|   |  - Advisory Locks for Worker Jobs    |   |  - Standalone One-Folder Portability |   |
|   +--------------------------------------+   +--------------------------------------+   |
|                              ^                                                          |
|                              |                                                          |
|   +--------------------------+------------------------------------------------------+   |
|   |                      Worker Daemon Container (Scheduler)                        |   |
|   |  - Same Docker Image as App (node dist/worker/index.js)                         |   |
|   |  - Database Advisory Lock Guard (pg_try_advisory_xact_lock)                     |   |
|   |  - Nightly Occurrence Generation (02:00) & Hourly Overdue Status Checker        |   |
|   |  - Daily Digest (08:00) & Weekly Orphaned File Disk Cleaner                     |   |
|   +---------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Technology Stack

- **Framework**: Next.js 15 (App Router) on Node 20 with `output: "standalone"`.
- **Language**: TypeScript 5.7 (Strict mode, `noUncheckedIndexedAccess`).
- **Styling**: Tailwind CSS with custom responsive UI design tokens.
- **Data Layer**: PostgreSQL 16 Alpine with Prisma ORM 5.
- **State Management**: TanStack React Query v5.
- **Form Management**: React Hook Form with Zod schemas shared across Client and API.
- **Document Generation**:
  - `pdfkit` for high-fidelity vector PDF generation.
  - `exceljs` for XLSX spreadsheet workbooks.
- **Media Pipeline**: `sharp` for EXIF/GPS stripping and WebP thumbnail generation.
- **File Sniffing**: `file-type` for binary magic-byte detection.
- **Scheduling**: `node-cron` with PostgreSQL advisory locks.

---

## 4. Key Architectural Patterns

### 4.1. Single Full-Stack TypeScript Monolith
There is no separate backend or frontend repository. The single codebase builds into a unified Docker image capable of running both the HTTP web application and the background worker daemon depending on the launch command.

### 4.2. Capability-Based Authorization
Hardcoded role checks (e.g., `role === 'ADMIN'`) are strictly prohibited in business logic. All authorization flows through:
```typescript
can(user, permissionKey, context)
```
Permissions are stored in the database and can be modified or overridden per-user without modifying code.

### 4.3. Materialized Path Forest Hierarchy
Seva tasks form a forest of hierarchical trees. Nodes track ancestors via materialized path strings:
`/<rootId>/<ancestorId>/.../<id>/`
- Depth is enforced (default <= 6, max 12).
- Cycle protection is validated in a single database transaction with subtree locking.
- Subtree roll-ups calculate progress percentage, earliest start date, latest due date, and budget aggregations efficiently without N+1 queries.

### 4.4. Two-Bucket File Storage Architecture
Every Seva supports two distinct, independent file storage buckets:
1. **Quotes Bucket**: Confidential quotation documents (PDF, Word, Excel, images). Strictly guarded by `quotes.view` capability.
2. **Artefacts Bucket**: Operational media (before/after photos, invoices, completion videos). Accessible to anyone authorized to view the Seva.

### 4.5. Contractors Central Directory & Dual-Tier Visibility
Contractors are managed as an integrated modular subsystem (`src/modules/contractors`):
1. **Open Read Tier (`contractors.read`)**: Accessible to every authenticated user. Displays identity, trading names, registered trades, contact names, phone/email, emergency hours, credential health badges (VALID / EXPIRING / EXPIRED), average review ratings, and non-financial historical Seva participation.
2. **Restricted Commercial Tier (`contractors.readFull`, `contractors.credentials.view`, etc.)**: Commercial rates, call-out fees, financial totals, internal coordinator notes, block reasons, credential license numbers, exact expiration dates, and sensitive documents are stripped server-side from all response shapes (REST API, global search, exports, ZIP archives).
3. **Immutable ID-Based Storage**: Documents and credentials reside in ID-isolated storage paths (`data/uploads/contractors/CON-XXXX/...` and `data/uploads/contractor-requests/CRQ-XXXX/...`). Company renaming never moves disk files.

### 4.6. Propose-and-Review Governance Pipeline
Every signed-in user can propose a new contractor or suggest changes to existing contractors:
1. Proposers submit structured drafts (`ContractorRequest` with `NEW_CONTRACTOR` or `UPDATE_CONTRACTOR`).
2. Input is strictly validated by Zod and stored untrusted; no requester input is applied automatically.
3. Reviewers inspect side-by-side field diffs, review version conflicts (optimistic concurrency locking), and can selectively accept or reject specific fields.
4. Approvals and rejections execute atomically in PostgreSQL transactions with comprehensive audit logging linking both requester and reviewer.

### 4.7. Licences Central Register & Quad-Tier Field Security
User qualifications and certifications are managed as an integrated modular subsystem (`src/modules/licences`):
1. **Canonical Holder Definition**: A user counts as a valid holder if and only if they are an active user holding a non-superseded, non-archived `UserLicence` of that type whose status is `VALID` or `EXPIRING_SOON` and is verified (`verifiedAt != null`). On any target date $D$, `expiresAt` must be null or $\ge D$. A user counts once per licence type regardless of how many classes they hold.
2. **Server-Side Field-Tier Stripping**:
   - *Directory Tier (`licences.directory.view`)*: Shows holder name, licence type, class, status badge, expiry month/year, and availability. Licence numbers, exact issue/expiry dates, restrictions/conditions, and uploaded files are completely stripped from responses.
   - *Contact Tier (`licences.directory.contact`)*: Unlocks direct phone and email contact endpoints with quick communication buttons.
   - *Sensitive Tier (`licences.sensitive.view`)*: Full numbers, conditions, and exact dates. Numbers remain masked by default (`••••• 482`) until an explicit, audited Reveal request is triggered.
   - *Documents Tier (`licences.documents.view`)*: Authenticated streaming file access with immutable audit trail.
   - *Highly Sensitive Isolation*: Highly sensitive records (Police Checks, WWCC, Driver Licences) require *both* `sensitive.view` and `documents.view` to reveal and are excluded from bulk exports.
3. **Volunteer Ranking Algorithm**: The volunteer matcher ranks candidates according to four strict deterministic criteria:
   - Primary: Candidates meeting all required licences valid on target date $D$ ranked ahead of partial holders.
   - Secondary: Availability tier (`AVAILABLE` before `LIMITED`).
   - Tertiary: Current operational workload (fewest open assigned Seva tasks in the next 7 days).
   - Quaternary: Longest remaining credential validity (highest average days remaining).
4. **Seva Task Requirements Integration**:
   - Seva tasks define required licence types, classes, and minimum required holders.
   - Assignee selection displays qualification status badges and provides an "Only show eligible people" filter.
   - Enforces compliance according to the `licenceEnforcement` setting: `WARN` requires assigner confirmation; `BLOCK` requires admin override with a mandatory logged reason.

---

## 5. Offline & Zero Recurring Cost Compliance

- **No External CDN Scripts**: All JavaScript and CSS are served directly by the standalone Next.js server.
- **No Remote Fonts**: Typography uses system font stacks and bundled `@fontsource` fonts.
- **Bundled Vector Icons**: Icons are rendered locally via `lucide-react`.
- **No Cloud Storage**: All uploads reside on local disk mounts (`./data/uploads`).
- **Telemtry Disabled**: `NEXT_TELEMETRY_DISABLED=1` is enforced globally.
- **HTTPS Options**: Free Let's Encrypt HTTPS via bundled Caddy profile or internal TLS for private local area networks.
