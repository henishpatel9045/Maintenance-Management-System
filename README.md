# Seva Maintenance Management System

A multi-user, mobile-first web app (installable PWA) engineered to manage community and organizational maintenance work. Built with Next.js 15 App Router, TypeScript, PostgreSQL 16, and Tailwind CSS.

---

## 1. Key Features

- **Hierarchical Seva (Task) Tree**: Organize maintenance into parent/child containers with automated progress, cost, and schedule roll-ups.
- **One-Time & Recurring Schedules**: Support for repair/new one-time jobs and flexible recurring schedules (daily, weekly, monthly, quarterly, yearly, every-N-days) with fixed and floating intervals.
- **Independent File Buckets**:
  - **Quotes**: Confidential contractor quotations with approval workflows, budget synchronization, and side-by-side quote comparison.
  - **Artefacts**: Operational before/after photos, completion verification videos, invoices, and documents.
- **Role-Based Capability Permissions**: Dynamic permissions for Administrators, Coordinators, and Members enforced strictly on the server.
- **Global File Library & Streaming ZIP Export**: Hierarchical file explorer with instant ZIP downloads maintaining folder structure.
- **Real-Time KPIs & Multi-Format Reports**: Live dashboard metrics and formatted exports in **PDF**, **Excel (XLSX)**, and **CSV**.
- **Self-Hosted & Zero Recurring Cost**: Runs entirely on your hardware via Docker with zero cloud dependencies and no external runtime network calls.

---

## 2. Quick Start in 4 Steps

### Step 1: Clone & Navigate
```bash
git clone <repository_url> seva-maintenance
cd seva-maintenance
```

### Step 2: Configure Secrets
```bash
cp .env.example .env
```
Open `.env` and set:
- `SESSION_SECRET`: A secure random string of at least 32 characters.
- `ADMIN_PASSWORD`: A secure passphrase for the initial administrator.

### Step 3: Start the Stack
```bash
docker compose up -d --build
```

### Step 4: Access the Application
Open your browser and navigate to:
**`http://localhost:8080`**

Sign in with:
- **Email**: `admin@seva.local` (or value of `ADMIN_EMAIL` in `.env`)
- **Password**: The password you set in `ADMIN_PASSWORD` (you will be prompted to change it on first login)

---

## 3. Persistent Data & Portability

All application state is strictly contained inside the `./data` folder via Docker bind mounts:
- `./data/postgres`: PostgreSQL database tables and indexes.
- `./data/uploads`: Quotes and Artefacts organized by immutable Seva codes.

**Server Migration**: To move the entire system to a new server, simply copy the project directory and run `docker compose up -d --build`.

---

## 4. Development & Testing Commands

All common tasks are automated via the included `Makefile`:

```bash
# Run unit, property, and recurrence tests
make test

# Run full security test suite (authorization matrix, path traversal, CSRF, throttling)
make security

# Run TypeScript compiler checks and ESLint
make lint

# Execute end-to-end automated smoke test
make smoke

# Run full local CI suite (lint + security + test + build)
make ci

# Generate backups
make backup
```

---

## 5. System Documentation

For detailed architectural and operational documentation, refer to the `docs/` folder:
- [Milestones & Plan](docs/PLAN.md)
- [Architectural Decisions](docs/DECISIONS.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Data Model & Prisma Schema](docs/DATA_MODEL.md)
- [Security Architecture & Threat Model](docs/SECURITY.md)
- [REST API Reference](docs/API.md)
- [Deployment & Operations Guide](docs/DEPLOY.md)
- [Modular Extensibility & Phase 2 Blueprint](docs/MODULES.md)
- [Open Source Licenses](docs/LICENSES.md)

---

## 6. Password Reset & Recovery Guide

### Method A: For Members & Coordinators (Via Web Admin Console)
Any System Administrator can reset passwords for coordinators and members directly within the application:
1. Navigate to the **System Administration Console** (`/admin`) and select the **Users & Roles** tab.
2. Click **Reset Password** (key icon) on the target user's row.
3. Enter a new password or click **Generate New** for a secure, readable passphrase.
4. Keep **Require password change on next login** checked so the user is prompted to set their own permanent password on sign-in.
5. Click **Reset Password**. A confirmation modal displays the temporary credentials with a one-click **Copy** button. All existing sessions for that user are automatically terminated.

### Method B: For Administrators (Emergency Terminal / Shell Recovery)
If an Administrator is locked out or has forgotten their password, the password can be reset directly from the host terminal or Docker shell **without needing the previous password**:

```bash
# Interactive mode (prompts for email, password, and options):
npm run reset-password

# Quick reset with auto-generated secure password:
npm run reset-password -- -e admin@seva.local

# Quick reset with custom password:
npm run reset-password -- -e admin@seva.local -p "YourNewSecurePassword123"

# Inside Docker container:
docker compose exec app npm run reset-password
# or via Makefile:
make reset-password
```

**Helpful CLI flags:**
- `--list` or `-l`: List all registered accounts and roles in the database.
- `--force-change`: Require the user to set a new password on their next login.
- `--no-force-change`: Allow direct login with the new password without mandatory change (default for CLI).

---

## 7. License

Open source under the [MIT License](docs/LICENSES.md).
