#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# Seva Maintenance System - Backup Script
# Creates timestamped database dump (gzipped)
# and uploaded files archive in ./backups/
# ==========================================

TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

echo "[SEVA BACKUP] Starting backup at ${TIMESTAMP}..."

# 1. Database backup via docker compose
DB_DUMP_FILE="${BACKUP_DIR}/seva_db_${TIMESTAMP}.sql.gz"
echo "[SEVA BACKUP] Dumping PostgreSQL database to ${DB_DUMP_FILE}..."
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-seva}" -d "${POSTGRES_DB:-seva_db}" --clean --if-exists | gzip > "${DB_DUMP_FILE}"

# 2. Uploaded files archive
UPLOADS_TAR_FILE="${BACKUP_DIR}/seva_uploads_${TIMESTAMP}.tar.gz"
echo "[SEVA BACKUP] Archiving ./data/uploads to ${UPLOADS_TAR_FILE}..."
if [ -d "./data/uploads" ]; then
  tar -czf "${UPLOADS_TAR_FILE}" -C ./data uploads
else
  echo "[SEVA BACKUP] Warning: ./data/uploads does not exist yet. Creating empty tar."
  tar -czf "${UPLOADS_TAR_FILE}" --files-from /dev/null
fi

# 3. Create manifest
MANIFEST_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.meta"
cat <<EOF > "${MANIFEST_FILE}"
timestamp=${TIMESTAMP}
database_file=$(basename "${DB_DUMP_FILE}")
uploads_file=$(basename "${UPLOADS_TAR_FILE}")
db_size=$(du -h "${DB_DUMP_FILE}" | cut -f1)
uploads_size=$(du -h "${UPLOADS_TAR_FILE}" | cut -f1)
status=SUCCESS
EOF

echo "[SEVA BACKUP] Backup completed successfully."
echo "[SEVA BACKUP] Database: ${DB_DUMP_FILE} ($(du -h "${DB_DUMP_FILE}" | cut -f1))"
echo "[SEVA BACKUP] Uploads:  ${UPLOADS_TAR_FILE} ($(du -h "${UPLOADS_TAR_FILE}" | cut -f1))"

# 4. Prune backups older than RETENTION_DAYS
echo "[SEVA BACKUP] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "seva_*" -mtime +"${RETENTION_DAYS}" -exec rm -f {} +
find "${BACKUP_DIR}" -type f -name "backup_*.meta" -mtime +"${RETENTION_DAYS}" -exec rm -f {} +

echo "[SEVA BACKUP] Backup routine finished."
