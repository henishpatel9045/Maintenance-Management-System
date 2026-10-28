#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# Seva Maintenance System - Backup Script
# Creates a single portable ZIP archive containing
# database dump, uploaded assets, and manifest
# ==========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
npx tsx "${SCRIPT_DIR}/backup.ts" "$@"
