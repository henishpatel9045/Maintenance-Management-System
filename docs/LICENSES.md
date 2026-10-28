# OPEN-SOURCE DEPENDENCY LICENSES

All runtime and development dependencies used in the Seva Maintenance Management System are open source under permissive licenses (MIT, Apache 2.0, BSD, ISC, or PostgreSQL License).

| Package | License | Description / Purpose |
| :--- | :--- | :--- |
| `next` | MIT | Full-stack web application framework (App Router) |
| `react`, `react-dom` | MIT | UI component library |
| `typescript` | Apache-2.0 | Typed JavaScript superset |
| `@prisma/client`, `prisma` | Apache-2.0 | Type-safe ORM & database migrations |
| `tailwindcss` | MIT | Utility-first CSS styling framework |
| `lucide-react` | ISC | Bundled SVG icon library |
| `@tanstack/react-query` | MIT | Client-side asynchronous state caching & synchronization |
| `react-hook-form` | MIT | Form state and validation library |
| `zod` | MIT | TypeScript-first schema declaration and validation |
| `pino`, `pino-pretty` | MIT | Low-overhead structured JSON logger |
| `@node-rs/argon2` | MIT | Memory-hard password hashing (Argon2id) |
| `bcryptjs` | MIT | Secondary password hashing fallback (cost 12) |
| `sharp` | Apache-2.0 | High-performance image re-encoding, EXIF stripping & thumbnailing |
| `file-type` | MIT | MIME sniffing via file magic bytes |
| `archiver` | MIT | Streaming ZIP archive generation |
| `pdfkit` | MIT | Server-side PDF generation engine |
| `exceljs` | MIT | Server-side XLSX Excel generation engine |
| `node-cron` | ISC | In-process cron job scheduler |
| `date-fns` | MIT | Modular date utility library |
| `recharts` | MIT | Composable charting library for dashboard KPIs |
| `vitest` | MIT | Fast unit & integration test runner |
| `fast-check` | MIT | Property-based testing framework |
| `@playwright/test` | Apache-2.0 | End-to-end browser automation framework |
| `postgres` (image) | PostgreSQL | PostgreSQL 16 relational database |

---

## Phase 2 (Contractors Module) Dependency Audit

The Contractors module was built entirely with zero new runtime dependencies, complying strictly with Section 1 of the specification:
- CSV import parsing & export generation: Native bounded string parser and buffered streaming with formula injection protection (`='`, `+'`, `-'`, `@'`).
- ABN checksum calculation: Native Australian Tax Office MOD 89 algorithm without external libraries.
- Luhn card number detection: Native checksum algorithm for payment card defense.
- Vector PDF profiles & Excel spreadsheets: Reused existing `pdfkit` and `exceljs` engines.

---

## Phase 2 (Licences and Skills Module) Dependency Audit

The Licences and Skills module was built entirely with zero new runtime dependencies, complying strictly with Section 1 of the specification:
- **Zero External API Calls**: All licence, ticket, certificate, and competency records are stored and evaluated entirely self-hosted without external verification lookups.
- **CSV & Excel Engine**: Built using native bounded parser and existing `exceljs` / `pdfkit` libraries with formula injection neutralization (`='`, `+'`, `-'`, `@'`).
- **File Upload & Image Sanitization**: Reused existing `sharp` and `file-type` pipeline for stripping EXIF/GPS metadata and re-encoding images to WebP/JPEG.
- **Skill Matching & Ranking**: Native deterministic 4-stage ranking algorithm in TypeScript.
- **Privacy & Masking**: Native Luhn detection for accidental card number rejection and server-side quad-tier masking engine.
