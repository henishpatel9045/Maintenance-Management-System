#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# Seva Maintenance System - Restore Script
# Restores complete application state from a backup ZIP
# ==========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
npx tsx "${SCRIPT_DIR}/restore.ts" "$@"
