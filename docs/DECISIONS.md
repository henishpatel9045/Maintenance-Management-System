# ARCHITECTURAL & DESIGN DECISIONS (DECISIONS.md)

This log records defaults and design decisions adopted in the Seva Maintenance Management System.

---

### DEC-001: Next.js 15 Standalone Output with App Router
- **Context**: The system must run as one single full-stack TypeScript codebase and Docker image without separate front/back repos.
- **Decision**: Next.js 15 App Router with `output: "standalone"` is used. Thin REST route handlers live under `/api/v1/`, OpenAPI spec is served at `/api/docs`, and Server/Client Components power the UI. The same Docker image runs the web application and the standalone worker process.

### DEC-002: Capability-Based Permissions over Hardcoded Roles
- **Context**: Section 4 & 6 require that roles are stored as database rows, and code never performs `role === 'ADMIN'`.
- **Decision**: Permissions are modeled as fine-grained string constants (`can(user, 'seva.create')`). The three system roles (ADMIN, COORDINATOR, MEMBER) are seeded with default permission maps, and configurable boolean settings (`coordinatorsCanEditSeva`, `membersSeeAllSeva`, `membersCanUploadArtefacts`, `assigneesCanUpdateStatus`, `membersCanViewReports`) dynamically adjust runtime capability checks.

### DEC-003: Hierarchy Tree Materialized Path & Depth Enforcement
- **Context**: Hierarchical seva trees must prevent cycles, support atomic moves, and compute server-side roll-ups efficiently.
- **Decision**: Materialized path format is `/<rootId>/<ancestorId>/.../<id>/`. Maximum depth is 6 by default (capped at 12 via DB CHECK constraint). Moves run in an isolated database transaction with optimistic locking on version, rewriting paths and depths for all descendants while asserting that target parent is not a descendant of the moved node.

### DEC-004: File Storage Structure and Split Buckets
- **Context**: Section 9 requires Quotes and Artefacts to be two separate buckets with distinct permissions, stored on disk without user-supplied names.
- **Decision**: Disk structure is `data/uploads/seva/<SEV-CODE>/quotes/<fileObjectId>.<ext>` and `data/uploads/seva/<SEV-CODE>/artefacts/<fileObjectId>.<ext>` with WebP thumbnails in `.thumbs/`. Seva code is immutable so moving seva across the hierarchy never moves files on disk. Original filenames are preserved strictly in the database.

### DEC-005: Recurrence Engine Horizon & Schedule Mode
- **Context**: Recurring tasks must generate occurrences idempotently for the near future without unbounded database rows.
- **Decision**: Occurrences are generated for a rolling 90-day horizon (`recurrenceHorizonDays`). When a FIXED recurrence rule is modified, only future PENDING occurrences are regenerated; in-progress, completed, and skipped occurrences remain untouched. For FLOATING recurrence, the next occurrence is calculated upon completion (`completedAt + interval`).

### DEC-006: Cryptographic Passwords and Session Management
- **Context**: Section 17 mandates layered security, argon2id hashing, revocable sessions, and no secrets in repositories.
- **Decision**: Argon2id is the primary password hasher with automatic bcrypt cost 12 fallback if native bindings are unavailable. Sessions use 256-bit crypto-random tokens stored in `httpOnly, SameSite=Lax` cookies; only their SHA-256 hashes are persisted in the database with idle (12h) and absolute (7d) expiration.

### DEC-007: Zero External Runtime Dependency (Offline Operation)
- **Context**: The app must operate fully offline once Docker images are built.
- **Decision**: UI uses bundled fonts and Lucide icons (`lucide-react`). No external CDN links, Google Fonts, or remote analytics are permitted. `NEXT_TELEMETRY_DISABLED=1` is configured.

### DEC-008: Concurrency Control via Optimistic Locking
- **Context**: Multiple users could update seva or occurrences concurrently.
- **Decision**: `Seva` and `Occurrence` include an integer `version` field. Updates must supply `expectedVersion`. If a mismatch is detected, the server aborts with HTTP 409 Conflict.

### DEC-009: Dual-Tier Contractor Visibility Model
- **Context**: The golden rule mandates that basic contractor identity and credential health are open to all authenticated users, but commercial rates, call-out fees, financials, internal notes, block reasons, and credential registration numbers must remain confidential to Coordinators and Admins.
- **Decision**: Implemented server-side data stripping (`sanitizeContractor`, `sanitizeCredential`, `sanitizeReview`, `sanitizeSevaContractor`) executed uniformly across all endpoints (REST, global search, exports, ZIP archives). If a restricted field is requested, it is omitted from the JSON payload rather than raising an error that reveals its presence.

### DEC-010: Propose-and-Review Governance Pipeline
- **Context**: Any user can suggest a new contractor or propose updates to an existing contractor, but untrusted input must never be applied automatically.
- **Decision**: Proposals are captured as `ContractorRequest` records with `proposedData` stored as untrusted jsonb. For updates, a snapshot of the target contractor's version (`_initialContractorVersion`) is recorded upon submission. If the contractor changes prior to review, an optimistic concurrency conflict is detected, requiring reviewer confirmation. Reviewers can accept or reject proposed fields individually (`acceptedFields`).

### DEC-011: Luhn Algorithm Rejection for Financial Card Defense
- **Context**: The golden rule strictly forbids storing credit card or bank account details in contractor records.
- **Decision**: A Luhn checksum validator (`detectLuhnCardNumber`) evaluates all textual fields. Input containing 13 to 19 digit sequences satisfying Luhn validation is rejected with HTTP 400 and user guidance.

### DEC-012: CSV & Excel Formula Injection Defense
- **Context**: Untrusted names or notes exported to spreadsheet applications could execute malicious formulas if prefixed with `=`, `+`, `-`, `@`, `\t`, or `\r`.
- **Decision**: `neutralizeFormula()` sanitizes all exported spreadsheet cells by prepending a single quote (`'`), rendering the content as literal text in spreadsheet software.

### DEC-013: Immutable ID-Based Contractor Storage
- **Context**: Contractor company names frequently rebrand or update trading names. Moving disk folders on company rename risks file loss or concurrency races.
- **Decision**: Disk storage paths are strictly keyed by generated code: `data/uploads/contractors/CON-XXXX/...` and `data/uploads/contractor-requests/CRQ-XXXX/...`. Company name updates leave storage paths untouched.
### DEC-014: Canonical Definition of a Licence Holder
- **Context**: The organisation needs a consistent, mathematically sound rule across summaries, directory filters, find-volunteer matching, dashboard widgets, and seva compliance checks to answer who is a valid "holder".
- **Decision**: Centralized in [holder.ts](file:///d:/WORK/Maintenance%20Management%20System/src/modules/licences/holder.ts). A "holder" must be an active user possessing a non-archived, non-superseded `UserLicence` in `VALID` or `EXPIRING_SOON` status, with verification completed (`verifiedAt != null`). Unverified self-submissions (`PENDING_VERIFICATION`) are strictly excluded unless the setting `countPendingAsHolders=true` is enabled. For any target date $D$, `expiresAt` must be null or $\ge D$. A person holding multiple classes of a type counts once toward the licence type holder total.

### DEC-015: Quad-Tier Licence Privacy and Audited Reveal
- **Context**: Licence numbers, exact validity dates, conditions, and document scans constitute sensitive personal data that must never leak to unauthorized parties or bulk exports.
- **Decision**: Implemented a four-tier server-enforced projection model in [tiers.ts](file:///d:/WORK/Maintenance%20Management%20System/src/modules/licences/tiers.ts):
  1. *Directory Tier* (`licences.directory.view`): User name, avatar, licence type, class, status badge, expiry month/year only, and availability. No numbers, exact issue/expiry dates, conditions, or files.
  2. *Contact Tier* (`licences.directory.contact`): Augments Directory tier with phone and email.
  3. *Sensitive Tier* (`licences.sensitive.view`): Unlocks exact dates, conditions, and notes. Licence numbers remain masked by default (`••••• 194`) until explicit Reveal action.
  4. *Documents Tier* (`licences.documents.view`): Grants access to download/stream document scans.
  - Number reveals and document downloads create append-only audit log records (`LICENCE_NUMBER_REVEALED`, `LICENCE_DOCUMENT_DOWNLOADED`).
  - Highly sensitive types (`isHighlySensitive = true`: Driver Licence, WWCC, Police Check) require BOTH `licences.sensitive.view` AND `licences.documents.view` (or being the holder) to access numbers and files, and are excluded from bulk exports and ZIP archives.

### DEC-016: Self-Referential Supersede Concurrency in Licence Renewal
- **Context**: The database enforces a PostgreSQL partial unique index `UNIQUE(user_id, licence_type_id, COALESCE(class, '')) WHERE archived_at IS NULL AND superseded_by_id IS NULL`. Inserting a renewal row before updating the prior active row raises a unique constraint violation because both rows momentarily have `superseded_by_id IS NULL`.
- **Decision**: In `LicenceService.renewLicence`, the transaction first sets `supersededById = existing.id` on the existing row. This self-referential foreign key satisfying update immediately excludes the row from the partial unique index, permits inserting `newRecord`, and subsequently updates `supersededById = newRecord.id` atomically.

### DEC-017: Volunteer Ranking Algorithm for Skill Matching
- **Context**: Coordinators need to find qualified, available volunteers for tasks on specific dates without manually cross-referencing calendars and certificates.
- **Decision**: In [volunteer.service.ts](file:///d:/WORK/Maintenance%20Management%20System/src/modules/licences/volunteer.service.ts), `POST /licence-find` ranks candidate volunteers deterministically:
  1. Complete qualification match: Candidates holding all required licences/classes valid on date $D$ rank ahead of partial matches.
  2. Availability status: `AVAILABLE` (0) > `LIMITED` (1) > `UNAVAILABLE` (2).
  3. Workload balancing: Users with fewer active seva assignments in the next 7 days rank higher.
  4. Longevity: Licences with the greatest remaining validity days rank higher.

### DEC-018: Seva Requirement Gating & Enforcement (WARN vs BLOCK)
- **Context**: Seva tasks (such as tree trimming, heavy lifting, or electrical work) may require certified holders. Assigning uncertified personnel poses safety and compliance hazards.
- **Decision**: Implemented configurable `licenceEnforcement` (`WARN` default, or `BLOCK`). In `WARN` mode, assigning an uncertified user generates an on-screen warning and requires explicit confirmation, recorded in the audit log. In `BLOCK` mode, assignment fails unless overridden by an Admin with a logged reason. The compliance evaluator computes validity against the specific future due date (or recurrence occurrence date) rather than today's date.

### DEC-019: Service Worker Cache Safety & Navigation Bypass
- **Context**: Legacy PWA service worker configurations that cache the start URL (`/`) or use cache-first strategies for HTML navigations cause intermittent access failures in authenticated SSR apps. If `/` was cached while unauthenticated, Chrome rejects redirected responses passed to `FetchEvent.respondWith()` on simple refresh (`ERR_FAILED`), while hard refresh (Ctrl+Shift+R) bypassed the service worker.
- **Decision**:
  1. The Service Worker ([public/sw.js](file:///d:/WORK/Maintenance%20Management%20System/public/sw.js)) must **never** intercept navigation requests (`request.mode === 'navigate'`) or API routes (`/api/*`). The browser handles all page navigations and redirects directly over the network.
  2. The service worker caches **only** immutable hashed static assets (`/_next/static/*`) that are same-origin, 200 OK, and non-redirected.
  3. On service worker activation, all legacy caches (`caches.keys()`) are purged, and `clients.claim()` is called immediately.
  4. The service worker is served with `Cache-Control: no-cache, no-store, must-revalidate` and registered with `{ scope: '/', updateViaCache: 'none' }`.
  5. Static assets (`/sw.js`, `/manifest.webmanifest`, `/_next/*`, `/icons/*`) are strictly excluded from authentication redirect middleware.

