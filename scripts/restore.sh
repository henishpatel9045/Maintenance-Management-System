#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# Seva Maintenance System - Restore Script
# Restores database dump and uploaded files archive
# Usage: ./scripts/restore.sh <TIMESTAMP>
# Example: ./scripts/restore.sh 20261026_120000
# ==========================================

if [ $# -lt 1 ]; then
  echo "Usage: $0 <TIMESTAMP>"
  echo "Example: $0 20261026_120000"
  echo "Available backups in ./backups:"
  ls -1 ./backups/*.sql.gz 2>/dev/null || echo "No backups found"
  exit 1
fi

TIMESTAMP="$1"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_DUMP_FILE="${BACKUP_DIR}/seva_db_${TIMESTAMP}.sql.gz"
UPLOADS_TAR_FILE="${BACKUP_DIR}/seva_uploads_${TIMESTAMP}.tar.gz"

if [ ! -f "${DB_DUMP_FILE}" ]; then
  echo "Error: Database backup file ${DB_DUMP_FILE} does not exist."
  exit 1
fi

echo "=========================================="
echo "WARNING: Restoring will overwrite existing database data and uploads!"
echo "Target timestamp: ${TIMESTAMP}"
echo "=========================================="

read -p "Are you sure you want to proceed? [y/N] " -r CONFIRM
if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
  echo "Restore aborted by user."
  exit 0
fi

# 1. Restore database
echo "[SEVA RESTORE] Restoring PostgreSQL database from ${DB_DUMP_FILE}..."
gunzip -c "${DB_DUMP_FILE}" | docker compose exec -T db psql -U "${POSTGRES_USER:-seva}" -d "${POSTGRES_DB:-seva_db}"

# 2. Restore uploads
if [ -f "${UPLOADS_TAR_FILE}" ]; then
  echo "[SEVA RESTORE] Restoring uploads to ./data/uploads from ${UPLOADS_TAR_FILE}..."
  mkdir -p ./data
  tar -xzf "${UPLOADS_TAR_FILE}" -C ./data
fi

echo "[SEVA RESTORE] Restore completed successfully."
