#!/bin/sh
set -e

echo "[SEVA] Initializing Seva Maintenance System container..."

# Ensure data uploads directory exists and is writable
mkdir -p /app/data/uploads
mkdir -p /app/data/uploads/seva

# Run Prisma schema migration
echo "[SEVA] Synchronizing database schema with Prisma..."
npx prisma db push --skip-generate

# Seed database if no users exist
echo "[SEVA] Checking if initial seeding is required..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log('[SEVA] No existing users found. Seeding database...');
    process.exit(10); // Code 10 indicates seed needed
  } else {
    console.log('[SEVA] Existing users found (' + userCount + '). Skipping seed.');
    process.exit(0);
  }
}
main().catch((err) => {
  console.error('[SEVA] Error checking users:', err);
  process.exit(1);
}).finally(() => prisma.\$disconnect());
" && SEED_NEEDED=$? || SEED_NEEDED=$?

if [ "$SEED_NEEDED" -eq 10 ]; then
  echo "[SEVA] Running database seed..."
  if [ -f "/app/dist/seed.js" ]; then
    node /app/dist/seed.js
  else
    npx tsx prisma/seed.ts
  fi
fi

echo "[SEVA] Startup preparation complete. Executing command: $@"
exec "$@"
