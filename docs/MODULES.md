# Extensibility & Modular Architecture: Seva Maintenance System

## 1. Modular Monolith Principles

The Seva platform is engineered as an extensible modular monolith. Each domain feature is encapsulated under `src/modules/<module_name>/`. Modules communicate through exported public functions, shared core infrastructure, and a central **Module Registry**.

---

## 2. Module Anatomy

A compliant module adheres to the standard layout:

```
src/modules/<module_name>/
  ├── manifest.ts          # Module metadata, permissions, nav items, and hooks
  ├── schemas.ts           # Zod validation schemas shared between Client & API
  ├── service.ts           # Pure business logic and database access
  ├── index.ts             # Public module facade (re-exports safe public symbols)
  ├── components/          # React presentation and form components
  └── tests/               # Unit, integration, and property tests
```

---

## 3. The Module Manifest (`manifest.ts`)

Every module registers its capabilities via an implementation of `ModuleManifest`:

```typescript
export interface ModuleManifest {
  id: string;                                   // Unique identifier (e.g. 'contractors')
  name: string;                                 // Human-readable title
  version: string;                              // Semantic version (e.g. '1.0.0')
  enabledByDefault: boolean;                    // Feature flag default
  navItems?: Array<{                            // Navigation bar entries
    label: string;
    href: string;
    icon: string;
    requiredPermission?: PermissionKey;
  }>;
  permissionKeys?: PermissionKey[];             // Capabilities introduced by this module
  settingsKeys?: string[];                      // Configuration keys
  dashboardWidgets?: string[];                  // Dashboard KPI widgets
  reportSections?: string[];                    // Available export sections
  searchProvider?: (query: string, user: AuthenticatedUser) => Promise<SearchResult[]>;
}
```

---

## 4. Module Registry (`src/modules/registry.ts`)

The central registry indexes all active modules in the system:

```typescript
export const MODULE_REGISTRY: Record<string, ModuleManifest> = {
  contractors: contractorsManifest,
  seva: sevaManifest,
  users: usersManifest,
  masters: mastersManifest,
  files: filesManifest,
  dashboard: dashboardManifest,
  reports: reportsManifest,
  notifications: notificationsManifest,
  settings: settingsManifest,
  comments: commentsManifest,
  requests: requestsManifest,
  audit: auditManifest,
  search: searchManifest,
};
```

---

## 4.1. Contractors Module (`src/modules/contractors`)

The Contractors module introduces a centralized directory of external service providers, licensing credentials, trade taxonomy, and proposal workflows:

- **Module ID**: `contractors`
- **Feature Flag**: `module.contractors.enabled` (default `true`)
- **Navigation**:
  - `Contractors`: `/contractors` (required capability: `contractors.read`)
- **Capabilities (13 keys)**:
  - `contractors.read`, `contractors.readFull`, `contractors.request`, `contractors.requests.review`, `contractors.write`, `contractors.credentials.view`, `contractors.credentials.manage`, `contractors.documents.view`, `contractors.documents.manage`, `contractors.reviews.write`, `contractors.assign`, `contractors.import`, `contractors.manage`.
- **Dashboard Widgets**:
  - `contractor-expiring-credentials`: Active credentials expiring within 30 days.
  - `contractor-top-spend`: Top 10 contractors by historical spend.
  - `contractor-open-requests`: Open proposal count for reviewers.
- **Search Provider**: Global search integration returning open-tier contractor records.

### Feature Flags
Any module can be dynamically disabled through the `Setting` table with the key `module.<id>.enabled`. When disabled:
- Its navigation items disappear from the desktop sidebar and mobile navigation drawer.
- Its API routes immediately return `404 Not Found`.

---

## 5. Module Scaffolding Generator

To generate a new module skeleton:

```bash
npm run new:module -- equipment
```

This automatically generates:
1. `src/modules/equipment/manifest.ts`
2. `src/modules/equipment/schemas.ts`
3. `src/modules/equipment/service.ts`
4. `src/modules/equipment/index.ts`
5. `src/modules/equipment/equipment.test.ts`

To activate the module:
1. Import and register the manifest in `src/modules/registry.ts`.
2. Add any additive Prisma schema models to `prisma/schema.prisma`.
3. Run `npm run prisma:migrate`.

---

## 6. Phase 2 Architecture Blueprint

Phase 1 code leaves complete architectural space for Phase 2 modules without requiring rewrites or breaking migrations:

### 6.1. Contractors Module
- **Purpose**: Manage external service companies, trade licenses, contact details, and quote links.
- **Additive Schema**:
  - `Contractor`: `companyName`, `tradingName`, `registrationNumber` (ABN/ACN), `status`, `address`, `website`, `notes`, `rating`.
  - `Trade`: Trade master list (e.g. Plumber, Electrician, Carpenter).
  - `ContractorTrade`: Association table.
  - `ContractorContact`: Representatives, emails, phone numbers.
  - Documents link via `FileLink` with expiry dates (`expiresAt`).
  - Additive migration adds `contractorId` foreign key to `SevaFile`.
- **Expiry Reminders**: Background jobs schedule reminders at 60, 30, and 7 days prior to contractor insurance expiration using the existing `Reminder` table.

### 6.2. Licences & Skills Module (`licences`)
- **Purpose**: Central register of licences, tickets, certificates, and competencies held by users and volunteers (Forklift, Elevated Work Platform, White Card, First Aid, CPR, Working at Heights, Electrical, etc.). Instantly answers: "How many people do we have with a Forklift licence? Who are they? Are they still valid? Who is available this Saturday?"
- **Feature Flag**: `module.licences.enabled` (default: `true`). Toggling off disables all licence endpoints (returns 404), removes the navigation entry, and hides assignee compliance badges.
- **Additive Schema**:
  - `LicenceCategory`: Plant and Equipment, Working at Heights, Electrical and Trades, First Aid and Safety, Driving and Transport, Site Induction, Compliance and Checks, Other.
  - `LicenceType`: Master definitions with codes, kinds, aliases, allowed classes, validity defaults, `minHoldersTarget`, and `isHighlySensitive`.
  - `UserLicence`: Member records with optimistic concurrency control (`version`), history preservation via `SUPERSEDED` status, verification status, and audit hooks.
  - `UserAvailability`: Member availability (`AVAILABLE`, `LIMITED`, `UNAVAILABLE`) with auto-revert support.
  - `SevaRequiredLicence`: Seva task requirements linking required licence types/classes and minimum holder thresholds.
  - `LicenceCountSnapshot`: Weekly metrics snapshot capturing valid, expiring, expired, and pending counts.
- **Capabilities (12 keys)**:
  - `licences.own.view`: See own licences, numbers, and uploaded scans.
  - `licences.own.submit`: Submit own licences, request renewals, upload scans, manage own availability.
  - `licences.directory.view`: Search directory, see badges, status, expiry month/year, availability.
  - `licences.directory.contact`: Quick call and email buttons for holders in the directory.
  - `licences.manage`: Create, edit, renew, suspend, revoke, archive licences for any user.
  - `licences.verify`: Review pending self-service submissions in the verification queue.
  - `licences.sensitive.view`: View licence numbers with audited on-demand Reveal (`••••• 482`).
  - `licences.documents.view`: View and download licence document scans.
  - `licences.types.manage`: Manage master types, categories, and holder targets.
  - `licences.seva.require`: Set required licences on Seva maintenance tasks.
  - `licences.reports.view`: Run and export reports (PDF, Excel, CSV) with formula injection protection.
  - `licences.import`: Bulk CSV import with validation preview and atomic commit.
- **Field Tiers**:
  - Directory Tier: Names, licence badges, expiry month/year, availability. Numbers, conditions, exact dates, and documents are stripped.
  - Contact Tier: Adds phone and email.
  - Sensitive Tier: Full numbers (masked by default until Reveal), exact dates, conditions.
  - Documents Tier: Authenticated streaming downloads with audit logging.
  - Highly Sensitive: Types with `isHighlySensitive = true` (Police Check, WWCC, Driver Licence) require *both* `sensitive.view` AND `documents.view` to reveal.
- **Worker Jobs (Advisory-Lock Protected)**:
  - `refreshLicenceStatus`: Daily at 02:45. Recomputes `VALID`, `EXPIRING_SOON`, `EXPIRED`, reverts expired availability windows.
  - `scheduleLicenceReminders`: Reminders at 60, 30, 7, and 0 days before expiration.
  - `licenceSnapshot`: Weekly snapshot of holder counts for trend sparklines and capacity planning.
  - `checkUpcomingSevaLicences`: Daily compliance check of upcoming seva tasks against assignee qualifications.

