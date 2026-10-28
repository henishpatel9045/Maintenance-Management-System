# REST API Reference: Seva Maintenance System

All REST API endpoints are served under `/api/v1` as Route Handlers. Authentication is maintained via HTTP-only session cookies (`seva_session`). Interactive documentation is served at `/api/docs`.

---

## 1. Response Formats & Standards

### Success Envelope
```json
{
  "data": { ... }
}
```

### Paginated Success Envelope
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 142,
    "totalPages": 6
  }
}
```

### Standard Error Envelope
```json
{
  "error": {
    "code": "SEVA_NOT_FOUND",
    "message": "Seva with the requested ID does not exist",
    "details": null,
    "requestId": "4d79685a-83b6-45ef-b12e-13c544e31e50"
  }
}
```

---

## 2. API Endpoints Catalog

### 2.1. System & Health
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Container liveness probe | Public |
| `GET` | `/api/ready` | Database readiness check | Public |
| `GET` | `/api/docs` | OpenAPI 3.0 specification & documentation | Public |

### 2.2. Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Authenticate with email/phone & password | Public (Throttled) |
| `POST` | `/auth/logout` | Revoke active session and clear cookie | Authenticated |
| `POST` | `/auth/logout-all` | Revoke all sessions across all devices | Authenticated |
| `POST` | `/auth/change-password` | Update user password and rotate session | Authenticated |
| `GET` | `/auth/me` | Fetch active user profile, role, and capabilities | Authenticated |

### 2.3. Users & Roles (`/api/v1/users`, `/api/v1/roles`)
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/users` | List users with search, role, and active status filters | `users.manage` |
| `POST` | `/users` | Create a new user with temporary password | `users.manage` |
| `GET` | `/users/:id` | Get user details and assigned seva tasks | `users.manage` |
| `PATCH` | `/users/:id` | Update user profile, role, or active status | `users.manage` |
| `POST` | `/users/:id/reset-password` | Administrative temporary password reset | `users.manage` |
| `GET` | `/roles` | List system roles and capability permissions | Authenticated |

### 2.4. Master Data (`/api/v1/masters`)
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/masters/categories` | List maintenance categories | `seva.read` |
| `POST` | `/masters/categories` | Create category | `masters.manage` |
| `PATCH` | `/masters/categories/:id` | Update category name, color, description | `masters.manage` |
| `GET` | `/masters/areas` | List maintenance areas | `seva.read` |
| `GET` | `/masters/areas/tree` | Hierarchical tree of areas (Building > Floor > Room) | `seva.read` |
| `POST` | `/masters/areas` | Create area node | `masters.manage` |
| `PATCH` | `/masters/areas/:id` | Update area node | `masters.manage` |
| `GET` | `/masters/tags` | List all tags | `seva.read` |
| `POST` | `/masters/tags` | Create a new tag | `masters.manage` |

### 2.5. Seva Tasks & Hierarchy (`/api/v1/seva`)
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/seva` | Filterable seva list (kind, priority, category, area, status, assignee) | `seva.read` |
| `POST` | `/seva` | Create new seva (one-time or recurring) | `seva.create` |
| `GET` | `/seva/:id` | Get seva detail with assignees, checklist, and breadcrumbs | `seva.read` |
| `PATCH` | `/seva/:id` | Update seva fields (with optimistic lock `expectedVersion`) | `seva.update` |
| `POST` | `/seva/:id/archive` | Archive seva (with optional `?subtree=true` for groups) | `seva.archive` |
| `POST` | `/seva/:id/unarchive` | Restore archived seva | `seva.archive` |
| `POST` | `/seva/:id/move` | Reparent seva in tree with cycle & depth checks | `seva.update` |
| `POST` | `/seva/:id/convert-group` | Convert leaf seva to group container | `seva.update` |
| `POST` | `/seva/:id/duplicate` | Duplicate seva as a new template/job | `seva.create` |
| `GET` | `/seva/:id/rollup` | Calculate subtree roll-up progress, dates, and costs | `seva.read` |
| `PUT` | `/seva/:id/assignees` | Replace assignees list and designate lead | `seva.assign` |
| `POST` | `/seva/:id/watchers` | Add watcher to seva | `seva.read` |
| `DELETE` | `/seva/:id/watchers` | Remove watcher from seva | `seva.read` |
| `GET` | `/seva/tree` | Hierarchical forest tree of sevas with lazy loading | `seva.read` |

### 2.6. Work Occurrences (`/api/v1/occurrences`)
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/occurrences` | List occurrences with overdue, mine, and date filters | `seva.read` |
| `GET` | `/occurrences/upcoming` | Upcoming occurrences grouped by day (7/30/90 days) | `seva.read` |
| `PATCH` | `/occurrences/:id/status` | Transition status (PENDING -> IN_PROGRESS -> DONE / SKIPPED) | `occurrence.updateStatus` |
| `PATCH` | `/occurrences/:id/checklists/:itemId` | Toggle checklist item completion | `occurrence.updateStatus` |

### 2.7. Files, Quotes & Artefacts (`/api/v1/files`, `/api/v1/seva/:id/files`)
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/seva/:id/files` | List files in Quote or Artefact bucket | `artefacts.view` / `quotes.view` |
| `POST` | `/seva/:id/files` | Multi-file multipart upload pipeline | `artefacts.upload` / `quotes.upload` |
| `PATCH` | `/files/:id` | Update file caption, quote metadata, or move bucket | `artefacts.manage` / `quotes.manage` |
| `DELETE` | `/files/:id` | Soft-delete file | `artefacts.manage` / `quotes.manage` |
| `POST` | `/files/:id/restore` | Restore soft-deleted file | `artefacts.manage` / `quotes.manage` |
| `POST` | `/files/:id/approve-quote` | Approve quote, sync approvedBudget, audit action | `quotes.manage` |
| `POST` | `/files/:id/revoke-quote` | Revoke quote approval | `quotes.manage` |
| `GET` | `/seva/:id/quotes/compare` | Side-by-side quote comparison matrix | `quotes.view` |
| `GET` | `/files/:id/download` | Authenticated file download (supports HTTP Range) | `files.download` |
| `GET` | `/files/:id/thumbnail` | Fast WebP thumbnail stream | `files.download` |
| `GET` | `/seva/:id/files.zip` | Stream hierarchical folder structure ZIP | `files.download` |
| `GET` | `/files/tree` | Global File Library folder tree | `files.download` |
| `GET` | `/files/usage` | Total storage disk usage statistics | `settings.manage` |

### 2.8. Comments, Requests & Notifications
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/comments` | List comments for an entity | `seva.read` |
| `POST` | `/comments` | Add comment with @mention notifications | `comments.create` |
| `GET` | `/requests` | List user seva requests | `requests.manage` |
| `POST` | `/requests` | Submit maintenance request | `requests.create` |
| `POST` | `/requests/:id/convert` | Convert request into actionable seva task | `requests.manage` |
| `GET` | `/notifications` | List user notifications with unread count | Authenticated |
| `PATCH` | `/notifications/:id/read` | Mark individual notification as read | Authenticated |
| `POST` | `/notifications/read-all` | Mark all notifications as read | Authenticated |

### 2.9. Dashboard, Reports & Search
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard/kpis` | KPI summary cards (Total, Done, Overdue, Budget) | `seva.read` |
| `GET` | `/dashboard/charts` | Chart datasets (Status donut, spend, workload) | `seva.read` |
| `POST` | `/reports/preview` | Generate structured table report for date range | `reports.view` |
| `POST` | `/reports/export` | Download report formatted as PDF, Excel, or CSV | `reports.view` |
| `GET` | `/search` | Global search across Sevas, files, and users | `seva.read` |

### 2.10. Contractors Module (`/api/v1/contractors`, `/api/v1/contractor-requests`)
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/contractors` | Filtered directory listing (field tiers applied) | `contractors.read` |
| `POST` | `/contractors` | Create contractor with initial contacts & trades | `contractors.write` |
| `GET` | `/contractors/:id` | Single contractor detail with full relations (field tiers applied) | `contractors.read` |
| `PATCH` | `/contractors/:id` | Update contractor details with expectedVersion lock | `contractors.write` |
| `POST` | `/contractors/:id/archive` | Soft-archive contractor | `contractors.write` |
| `POST` | `/contractors/:id/unarchive` | Restore archived contractor | `contractors.write` |
| `POST` | `/contractors/:id/block` | Block contractor with mandatory reason & notification | `contractors.manage` |
| `POST` | `/contractors/:id/unblock` | Restore blocked contractor to active status | `contractors.manage` |
| `GET` | `/contractors/duplicates` | Search near-duplicates by name or registration number | `contractors.read` |
| `GET` | `/contractors/export` | Export directory to CSV, Excel, or PDF with formula injection defense | `contractors.read` |
| `POST` | `/contractors/import/preview` | Validate uploaded CSV and return row error preview | `contractors.import` |
| `POST` | `/contractors/import/commit` | Commit validated CSV rows in an atomic transaction | `contractors.import` |
| `GET` | `/contractors/import/template` | Download official CSV import template | `contractors.import` |
| `GET` | `/contractors/:id/contacts` | List active contacts for contractor | `contractors.read` |
| `POST` | `/contractors/:id/contacts` | Add new contact person | `contractors.write` |
| `PATCH` | `/contacts/:contactId` | Update contact person details | `contractors.write` |
| `DELETE` | `/contacts/:contactId` | Soft-delete contact person | `contractors.write` |
| `POST` | `/contacts/:contactId/make-primary` | Set primary contact (enforces single primary) | `contractors.write` |
| `PUT` | `/contractors/:id/trades` | Update assigned trades and primary trade | `contractors.write` |
| `GET` | `/contractors/:id/credentials` | List credentials (numbers/dates stripped for members) | `contractors.read` |
| `POST` | `/contractors/:id/credentials` | Add license, insurance, or certification | `contractors.credentials.manage` |
| `PATCH` | `/credentials/:credentialId` | Update credential details | `contractors.credentials.manage` |
| `POST` | `/credentials/:credentialId/verify` | Mark credential verified with audit timestamp | `contractors.credentials.manage` |
| `DELETE` | `/credentials/:credentialId` | Revoke credential | `contractors.credentials.manage` |
| `GET` | `/contractors/:id/files` | List attached documents and scans | `contractors.documents.view` |
| `POST` | `/contractors/:id/files` | Upload document or scan to contractor folder | `contractors.documents.manage` |
| `GET` | `/contractors/:id/files.zip` | Download all contractor documents as ZIP archive | `contractors.documents.view` |
| `GET` | `/contractors/:id/reviews` | List reviews (comment text stripped for members) | `contractors.read` |
| `POST` | `/contractors/:id/reviews` | Submit performance review with 1-5 ratings | `contractors.reviews.write` |
| `GET` | `/contractors/:id/jobs` | Historical list of engaged Seva tasks | `contractors.read` |
| `GET` | `/contractors/:id/quotes` | Historical quotes submitted across Seva tasks | `contractors.readFull` |
| `GET` | `/contractors/:id/spend` | Total spend aggregations (quoted, final, invoiced) | `contractors.readFull` |
| `GET` | `/contractor-requests` | Review queue of proposals (filtered by status) | `contractors.requests.review` |
| `POST` | `/contractor-requests` | Submit Suggest New Contractor or Suggest Change | `contractors.request` |
| `GET` | `/contractor-requests/mine` | List proposals submitted by active caller | `contractors.request` |
| `GET` | `/contractor-requests/:id` | Fetch request with side-by-side diff comparison | Owner / `contractors.requests.review` |
| `POST` | `/contractor-requests/:id/approve` | Approve proposal with per-field selection | `contractors.requests.review` |
| `POST` | `/contractor-requests/:id/reject` | Reject proposal with reason | `contractors.requests.review` |
| `POST` | `/contractor-requests/:id/more-info` | Request additional information from proposer | `contractors.requests.review` |
| `POST` | `/contractor-requests/:id/withdraw` | Withdraw own OPEN proposal | Owner |
| `GET` | `/trades` | List active trades taxonomy | `contractors.read` |
| `POST` | `/trades` | Create new trade category | `contractors.manage` |
| `PATCH` | `/trades/:id` | Update trade definition | `contractors.manage` |
| `GET` | `/category-trades` | List Seva category to trade mapping | `contractors.read` |
| `PUT` | `/category-trades` | Update category to trade mappings | `contractors.manage` |
| `GET` | `/seva/:id/contractors` | List contractors engaged on Seva task | `seva.read` |
| `PUT` | `/seva/:id/contractors` | Assign or update contractor role & financials | `contractors.assign` |
| `GET` | `/seva/:id/contractors/suggestions` | Suggested contractors based on category mapping | `contractors.read` |
| `GET` | `/contractors/link-quotes/suggestions` | Trigram suggestions for unlinked quotes | `contractors.manage` |
| `POST` | `/files/link-contractor` | Confirm quote to contractor link | `contractors.manage` |

### 2.11. Licences, Tickets & Skills (`/api/v1/...`)
| Method | Endpoint | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/licence-types` | List active licence types with category & counts | Authenticated |
| `POST` | `/licence-types` | Create new licence type with aliases and classes | `licences.types.manage` |
| `PATCH` | `/licence-types/:id` | Update licence type metadata and targets | `licences.types.manage` |
| `GET` | `/licence-categories` | List licence categories | Authenticated |
| `GET` | `/me/licences` | List caller's licences with unmasked numbers and files | `licences.own.view` |
| `POST` | `/me/licences` | Self-submit new licence for admin verification | `licences.own.submit` |
| `POST` | `/me/licences/:id/renew` | Submit renewal with new expiry date and card scan | `licences.own.submit` |
| `GET` | `/me/availability` | Fetch caller's current availability status and notes | `licences.own.view` |
| `PUT` | `/me/availability` | Update caller's availability status and auto-revert date | `licences.own.submit` |
| `GET` | `/users/:id/licences` | List licences held by user (field-tier sanitized) | `licences.directory.view` |
| `POST` | `/users/:id/licences` | Admin directly records licence for user | `licences.manage` |
| `GET` | `/licences/:id` | Fetch licence details (field-tier sanitized) | `licences.directory.view` |
| `PATCH` | `/licences/:id` | Admin update licence details (optimistic locking) | `licences.manage` |
| `POST` | `/licences/:id/verify` | Approve pending submission with optional edits | `licences.verify` |
| `POST` | `/licences/:id/reject` | Reject pending submission with mandatory reason | `licences.verify` |
| `POST` | `/licences/:id/suspend` | Temporarily suspend a licence | `licences.manage` |
| `POST` | `/licences/:id/revoke` | Permanently revoke a licence | `licences.manage` |
| `POST` | `/licences/:id/archive` | Archive licence record | `licences.manage` |
| `POST` | `/licences/:id/reveal-number` | Audited reveal of masked licence number | `licences.sensitive.view` |
| `GET` | `/licences/:id/files` | List attached scan documents | `licences.documents.view` |
| `POST` | `/licences/:id/files` | Upload front/back card scans | `licences.manage` / `licences.own.submit` |
| `GET` | `/licences/:id/files/:fileLinkId` | Stream/download document scan with audit | `licences.documents.view` |
| `GET` | `/licence-directory` | Filterable directory with alias search and tier masking | `licences.directory.view` |
| `GET` | `/licence-summary` | Organizational holder counts and target progress | `licences.directory.view` |
| `GET` | `/licence-summary/:typeId/holders` | Drilldown active holders of a licence type | `licences.directory.view` |
| `GET` | `/licence-matrix` | User x Licence Type grid matrix | `licences.directory.view` |
| `GET` | `/licence-trends` | 12-week longitudinal snapshot metrics | `licences.directory.view` |
| `POST` | `/licence-find` | Deterministic 4-stage volunteer ranking matcher | `licences.directory.view` |
| `GET` | `/seva/:id/required-licences` | List required tickets on Seva task | `seva.read` |
| `PUT` | `/seva/:id/required-licences` | Configure required tickets on Seva task | `licences.seva.require` |
| `GET` | `/seva/:id/licence-check` | Check assignee compliance against required licences | `seva.read` |
| `GET` | `/licences/pending` | Admin verification queue | `licences.verify` |
| `POST` | `/licence-reports/preview` | Preview tabular report data | `licences.reports.view` |
| `POST` | `/licence-reports/export` | Formula-safe CSV, XLSX, or PDF report export | `licences.reports.view` |
| `POST` | `/licences/import/preview` | Preview and validate bulk CSV import rows | `licences.import` |
| `POST` | `/licences/import/commit` | Transactionally commit validated CSV import | `licences.import` |
| `GET` | `/licences/import/template` | Download CSV template for bulk onboarding | `licences.import` |
