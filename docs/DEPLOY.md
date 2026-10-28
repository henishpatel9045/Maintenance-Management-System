# Deployment & Operations Guide: Seva Maintenance System

## 1. Quick Start: Single-Command Deployment

The entire stack (PostgreSQL database, standalone Next.js App, and Worker scheduler) boots on any machine with Docker installed using **one command**:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env and set strong secrets
# (Set SESSION_SECRET to at least 32 random characters and ADMIN_PASSWORD)

# 3. Start the system
docker compose up -d --build
```

The application is now live at: **`http://localhost:8080`**

Sign in with the initial administrator credentials:
- **Email**: `admin@seva.local` (or `ADMIN_EMAIL` configured in `.env`)
- **Password**: The value configured in `ADMIN_PASSWORD` (forced change on first login)

---

## 2. Server Deployment (Ubuntu / Debian Home Server or VPS)

### 2.1. Prerequisites
- Docker Engine 24+ and Docker Compose v2.
- At least 2GB of RAM and 10GB of local disk space.

### 2.2. Directory & Permissions Setup
```bash
# Clone repository
git clone <repository_url> /opt/seva-maintenance
cd /opt/seva-maintenance

# Configure environment
cp .env.example .env
nano .env

# Ensure persistent mount directories exist
mkdir -p data/postgres data/uploads backups

# Launch containers in background
docker compose up -d --build
```

---

## 3. HTTPS Configuration

### Option A: Free Automatic HTTPS with Bundled Caddy Profile
When deploying on a server with a public domain pointing to your IP:
1. In `.env`, set:
   ```env
   DOMAIN=maintenance.yourcommunity.org
   COOKIE_SECURE=true
   ```
2. Launch with the `https` profile:
   ```bash
   docker compose --profile https up -d --build
   ```
   Caddy automatically requests, verifies, and renews a free Let's Encrypt SSL/TLS certificate.

### Option B: Private LAN HTTPS (`tls internal`)
For private offline or intranet deployments without a public domain name, Caddy's internal certificate authority can provide HTTPS:
1. In `.env`, set:
   ```env
   DOMAIN=localhost
   COOKIE_SECURE=true
   ```
2. Start Caddy:
   ```bash
   docker compose --profile https up -d
   ```

### Option C: Behind an Existing Reverse Proxy (Nginx, Traefik, HAProxy)
Keep Caddy disabled. Point your existing proxy to port `8080` on the host:
```nginx
server {
    server_name maintenance.yourcommunity.org;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Backups and Disaster Recovery

### 4.1. Manual Backup
Run the automated backup script:
```bash
./scripts/backup.sh
```
This generates two files in `./backups/`:
1. `seva_db_<TIMESTAMP>.sql.gz`: Compressed PostgreSQL database dump.
2. `seva_uploads_<TIMESTAMP>.tar.gz`: Gzipped archive of `./data/uploads`.
3. `backup_<TIMESTAMP>.meta`: Verification metadata.

### 4.2. Automated Nightly Backups (Cron)
Add a cron job on the host machine:
```bash
# Run backup nightly at 03:00 and clean archives older than 30 days
0 3 * * * cd /opt/seva-maintenance && ./scripts/backup.sh >> /var/log/seva_backup.log 2>&1
```

### 4.3. Restoring from a Backup
To restore a specific backup timestamp:
```bash
./scripts/restore.sh 20261026_030000
```

---

## 5. Upgrades & Maintenance

Because all persistent state resides strictly within `./data` (`./data/postgres` and `./data/uploads`), updating the application requires no database migrations by hand:

```bash
# Pull newest code
git pull origin main

# Rebuild and restart containers
docker compose up -d --build
```
The container entrypoint will automatically detect schema changes, apply Prisma migrations, and start the upgraded service.

---

## 6. Environment Reference (`.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `APP_PORT` | `8080` | Host port on which Seva web application is exposed |
| `NODE_ENV` | `production` | Node.js runtime environment |
| `DATABASE_URL` | `postgresql://...` | Connection string to PostgreSQL container |
| `POSTGRES_USER` | `seva` | PostgreSQL database user |
| `POSTGRES_PASSWORD` | `...` | PostgreSQL database password |
| `POSTGRES_DB` | `seva_db` | PostgreSQL database name |
| `SESSION_SECRET` | *Required* | Minimum 32-character secret for cryptographic token hashing |
| `COOKIE_SECURE` | `false` | Set to `true` when accessing via HTTPS |
| `UPLOAD_DIR` | `/app/data/uploads` | Path to persistent storage directory for quotes and artefacts |
| `TZ` | `Australia/Adelaide` | Organisation timezone (e.g. `Australia/Adelaide`, `UTC`) |
| `ADMIN_NAME` | `System Administrator` | Full name of default initial administrator |
| `ADMIN_EMAIL` | `admin@seva.local` | Email address of initial administrator |
| `ADMIN_PASSWORD` | *Required* | Temporary password for initial administrator (min 10 chars) |
| `SEED_DEMO` | `false` | When `true`, populates sample community temple project data |
| `DOMAIN` | `localhost` | Domain name for automatic HTTPS in Caddy |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `NEXT_TELEMETRY_DISABLED` | `1` | Strictly disables Next.js telemetry collection |
| `SMTP_HOST` | *(Optional)* | Outgoing SMTP server hostname |
| `SMTP_PORT` | `587` | Outgoing SMTP port |
| `SMTP_USER` | *(Optional)* | Outgoing SMTP username |
| `SMTP_PASSWORD` | *(Optional)* | Outgoing SMTP password |
| `SMTP_FROM` | `Seva <no-reply@...>` | From header on notification emails |
