# Security Architecture & Threat Model: Seva Maintenance System

## 1. Overview & Security Philosophy

The Seva Maintenance Management System is designed with **layered defense-in-depth**, **deny-by-default access control**, and **zero trust** across all data, file, and API boundaries.

---

## 2. Threat Model & Residual Risks

| Threat Category | Potential Attack Vector | Layered Defense in Seva | Residual Risk & Operational Mitigation |
| :--- | :--- | :--- | :--- |
| **Authentication & Sessions** | Brute force password guessing, credential stuffing | Argon2id hashing; min 10 chars; common password dictionary blacklist; rate limiter (5 req/min, 15 min lock after 10 fails); identical error text and constant-time comparison | Compromised admin password via shoulder-surfing. Mitigation: rotate admin credentials regularly, enforce unique passphrases. |
| **Session Hijacking** | Token sniffing, cookie manipulation, cross-site script leakage | 256-bit crypto tokens in `httpOnly`, `SameSite=Lax`, `Secure` cookies; SHA-256 hash stored in DB; 12h idle timeout; 7d absolute timeout; rotation on login/password change; global revocation endpoint | Physical access to unlocked workstation before idle timeout expires. |
| **Broken Object-Level Auth (BOLA / IDOR)** | Direct UUID enumeration to access private records or quotes | Dynamic capability engine `can(user, perm, ctx)`; mandatory object-level check on every route; quotes hidden from members by default | Coordinator sharing physical screenshots of approved quote documents. |
| **Cross-Site Request Forgery (CSRF)** | Forged requests from external origins | Browser `Sec-Fetch-Site: cross-site` rejection; strict `Origin` vs `Host` comparison on mutating verbs (POST, PUT, PATCH, DELETE); SameSite cookies | Browser bug in obsolete browsers. Mitigation: require modern standards-compliant browser. |
| **Malicious File Uploads** | Renamed executables (.exe as .pdf), SVG with embedded script, ZIP slip, oversized denial-of-service | Extension allow-list; binary magic-byte sniffing via `file-type`; strict rejection of SVG/HTML/JS/EXE; sharp image re-encoding (stripping EXIF/GPS); streaming file size limits; UUID storage names; path traversal checks; path sanitization in ZIP exports | Zero-day vulnerability in `sharp` or `pdfkit`. Mitigation: keep Alpine and npm packages updated. |
| **Injection (SQL, NoSQL, Code)** | SQL injection via user input | 100% Prisma parameterized queries; strict Zod schema validation; query raw restricted to parameter templates | None identified in application layer. |
| **Cross-Site Scripting (XSS)** | Injected `<script>` or event handlers in task descriptions or comments | Strict Content Security Policy (`script-src 'self' 'nonce-...'`); `dangerouslySetInnerHTML` is prohibited; React virtual DOM auto-escaping; JSON response types | Browser extension injecting code locally. |
| **Path Traversal** | `../../` in file downloads or storage driver | `LocalDiskStorageDriver.getAbsolutePath()` resolves path and enforces `resolved.startsWith(baseDir)`; throws 400 `INVALID_STORAGE_PATH` on traversal | Misconfigured Docker host volume mapping outside project directory. |

---

## 3. Layered Security Implementation

### 3.1. Authentication & Session Security
- **Password Hashing**: `@node-rs/argon2` with Argon2id parameters (Memory: 64MB, Iterations: 3, Output: 32 bytes). Seamless fallback to bcrypt cost 12 if native binaries are unavailable.
- **Session Tokens**: Generated with Node.js `crypto.randomBytes(32)` (256 bits). Only the SHA-256 hash is persisted in the database.
- **Session Revocation**:
  - Logout terminates the active session.
  - "Sign out of all devices" invalidates all tokens associated with the user account.
  - Changing password automatically revokes all other existing sessions.

### 3.2. Authorization & Capability Engine
- No hardcoded role strings (e.g. `role === 'ADMIN'`) exist in business features.
- Every route handler is wrapped by `withAuth({ permission })`.
- Object-level ownership and assignment checks prevent privilege escalation.

### 3.3. Secure Upload Pipeline
```
Upload Stream 
   │
   ├── 1. Filename & Extension Allowlist Check (Disallow .exe, .sh, .svg, .html, .js)
   ├── 2. Magic-Byte Sniffing (file-type library inspects binary header)
   ├── 3. Size Limit Enforcement (Images: 10MB, Docs: 25MB, Videos: 50MB)
   ├── 4. SHA-256 Checksum Calculation & Deduplication Flagging
   ├── 5. Sharp Image Processing: Re-encode JPEG/PNG/WebP, strip EXIF and GPS tags
   ├── 6. WebP 300x300 Thumbnail Generation
   └── 7. UUID-Based Storage Key (/seva/<CODE>/<bucket>/<uuid>.<ext>)
```

### 3.4. HTTP Security Headers & CSP
The Next.js middleware injects strict security headers on every response:
- **Content-Security-Policy**: `default-src 'self'; script-src 'self' 'nonce-...'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; frame-ancestors 'none';`
- **X-Frame-Options**: `DENY`
- **X-Content-Type-Options**: `nosniff`
- **Referrer-Policy**: `same-origin`
- **Permissions-Policy**: `camera=(self), microphone=(), geolocation=()`
- **Cache-Control**: `no-store, no-cache, must-revalidate` on all API endpoints.

### 3.5. Container Hardening
- **Non-Root Execution**: Runs as unprivileged user `nextjs` (UID: 1001, GID: 1001).
- **Network Isolation**: PostgreSQL runs on internal network `seva-net` with protected credentials.
- **Resource Limits**: CPU and memory limits are defined in `docker-compose.yml`.

### 3.6. Contractors Module Security Controls

#### Dual-Tier Field Stripping
Contractor endpoints implement strict server-side stripping (`sanitizeContractor`, `sanitizeCredential`, `sanitizeReview`, `sanitizeSevaContractor`) based on authenticated caller capabilities:
- **Open Tier (`contractors.read`)**: Company name, trades, contacts, public badge statuses (VALID, EXPIRING_SOON, EXPIRED), star rating averages, linked task names.
- **Restricted Tier (`contractors.readFull`, `contractors.credentials.view`, `contractors.documents.view`)**: Hourly rate, call-out fee, internal notes, block reason, spend totals, credential registration/license numbers, exact expiration dates, and attached file links.
- Stripping applies across all endpoints: directory listings, contractor detail, global search, CSV/Excel/PDF exports, and ZIP archives. Restricted fields are removed from JSON objects rather than returning error hints.

#### Credit Card & Payment Detail Prohibition (Luhn Check)
To enforce the hard constraint prohibiting financial card detail storage, all free-text input fields are scanned with a Luhn checksum detector (`detectLuhnCardNumber`). Any 13-19 digit sequence passing Luhn validation causes an immediate 400 validation error with guidance to exclude payment card details.

#### Formula Injection Neutralization (CSV & Excel)
All spreadsheet exports process textual cells through `neutralizeFormula()`. Any cell beginning with formula prefix characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is safely prepended with a single quote (`'`), preventing formula execution when opened in Microsoft Excel or LibreOffice Calc.

#### Request Quota & Rate Limiting
To defend against proposal spam:
- Maximum open requests per user: 5 (`contractorRequestMaxOpenPerUser`).
- Maximum requests per 24-hour window: 10 (`contractorRequestMaxPerDay`).
- Rate-limited submission endpoint.
- Proposer uploads restricted to maximum 3 files via the secure file pipeline.

### 3.7. Licences Module Security Controls & Privacy Architecture

#### Personal Data Classification & Privacy Note
The Licences and Skills register holds sensitive personal identification data including:
- Government licence and credential numbers (Driver Licences, SafeWork High Risk Work licences, White Cards, Electrical Contractor licences).
- Verification scans and photographs (front and back identity card scans).
- Working With Children Checks (WWCC) and National Police History Checks.
- Exact dates of issue and expiry, operational restrictions/conditions, and supervisor verification notes.

#### Privacy Access Matrix (Server-Side Enforced)
Access is enforced strictly on the server across every response shape (list, detail, search, matrix, exports, reports, and notifications):
1. **The Licence Holder (`licences.own.view`)**: Always sees all fields, exact dates, unmasked numbers, and scans for their own licences.
2. **Directory Viewers (`licences.directory.view`)**: Receive ONLY user display name, licence type name, class, status badge (`VALID`, `EXPIRING_SOON`, `EXPIRED`), expiry month/year, and availability. Licence numbers, exact dates, conditions, and scans are completely omitted. If a user queries a field they are not permitted to see, it is returned as absent (never revealing its existence through error hints).
3. **Contact Permitted Viewers (`licences.directory.contact`)**: Unlocks phone and email endpoints with quick message buttons.
4. **Sensitive Viewers (`licences.sensitive.view`)**: Receives full numbers and conditions, but numbers are masked by default everywhere (`••••• 482`) until an explicit `POST /api/v1/licences/:id/reveal-number` request is submitted. Every reveal writes an immutable, append-only `ActivityLog` entry recording who revealed whose licence number and when.
5. **Document Viewers (`licences.documents.view`)**: Can view and download document scans. Streaming downloads write an append-only `ActivityLog` entry.
6. **Highly Sensitive Types (`isHighlySensitive = true`)**: Police Checks, WWCC, and Driver Licences are subject to heightened privacy controls:
   - Visible *only* to the holder and to users holding **BOTH** `licences.sensitive.view` AND `licences.documents.view`.
   - Excluded from all bulk ZIP archives and directory exports beyond a simple "valid check: yes/no" status badge.
   - Omitted from weekly aggregate metrics beyond anonymous counts.

#### Self-Service Anti-Abuse & Rate Limits
- Quota of maximum 5 open pending submissions per user (`licenceSubmitMaxPendingPerUser`).
- Rate limit of maximum 10 submissions per user per 24 hours (`licenceSubmitMaxPerDay`).
- Rate limiting on submission endpoints.
- Optimistic concurrency control (`version` and `expectedVersion`) on all licence updates, verification decisions, and renewals.

#### Credit Card & Formula Injection Defenses
- Luhn checksum scanner rejects any input containing credit or debit card numbers (`containsPaymentCard`).
- CSV and Excel exports prepend an apostrophe (`'`) to any cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r`.

---

## 4. Verification & Security Testing

All defenses are verified by automated tests in `tests/security/`:
1. `authMatrix.test.ts`: Complete authorization matrix across Anonymous, Deactivated, Member, Coordinator, and Admin.
2. `licencesSecurity.test.ts`: Licences authorization matrix, field-tier leakage defense (proving directory viewers never receive numbers or exact dates), IDOR protection across users and files, mass-assignment defense, Luhn payment card detection, CSV formula injection defense, quota limits, audited reveals, and optimistic locking conflict detection.
3. `contractorsSecurity.test.ts`: Contractors authorization matrix, field-tier leakage defense, Luhn card rejection, CSV formula injection defense, quota limits, and optimistic locking conflict detection.
4. `inputSanitization.test.ts`: SQL injection, XSS vectors, schema strictness, and password policies.
5. `pathTraversalAndUploads.test.ts`: Storage path traversal attempts (`../../etc/passwd`), Zip slip prevention, extension allowlists.
6. `csrfAndThrottling.test.ts`: Cross-origin request forgery verification, 5-per-minute brute-force throttle, and 15-minute account lockout.
