#!/usr/bin/env node
/**
 * Seva Maintenance Management System - Complete Backup Script
 * 
 * Creates a single, portable, self-contained ZIP archive containing:
 *  1. Full PostgreSQL database dump (database.sql)
 *  2. All uploaded files and assets (uploads/*) exactly as structured on disk
 *  3. Cryptographic integrity manifest (manifest.json with SHA-256 checksums)
 * 
 * Usage:
 *   npm run backup
 *   npx tsx scripts/backup.ts [--out <dir>] [--keep <count>] [--quiet]
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync, spawn } from "child_process";
import archiver from "archiver";

// 1. Resolve project root and load .env
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");

function loadEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line && !line.startsWith("#") && line.includes("=")) {
        const idx = line.indexOf("=");
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        env[key] = val;
      }
    }
  }
  return { ...env, ...process.env };
}

const config = loadEnv();
const POSTGRES_USER = config.POSTGRES_USER || "seva";
const POSTGRES_DB = config.POSTGRES_DB || "seva_maintenance";
const UPLOADS_DIR = path.join(PROJECT_ROOT, "data", "uploads");

// 2. Parse CLI Arguments
interface BackupOptions {
  outDir: string;
  keepCount: number;
  quiet: boolean;
}

function parseArgs(): BackupOptions {
  const args = process.argv.slice(2);
  let outDir = path.join(PROJECT_ROOT, "backups");
  let keepCount = 30; // Keep last 30 backups by default
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--out" || arg === "-o") {
      outDir = path.resolve(process.cwd(), args[++i] || "");
    } else if (arg === "--keep" || arg === "-k") {
      keepCount = parseInt(args[++i] || "30", 10) || 30;
    } else if (arg === "--quiet" || arg === "-q") {
      quiet = true;
    }
  }

  return { outDir, keepCount, quiet };
}

// 3. Helper to format timestamp
function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

// 4. Count files and total size recursively
function scanDirectory(dir: string): { count: number; size: number } {
  let count = 0;
  let size = 0;

  if (!fs.existsSync(dir)) return { count, size };

  function traverse(current: string) {
    const items = fs.readdirSync(current, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(current, item.name);
      if (item.isDirectory()) {
        traverse(fullPath);
      } else if (item.isFile()) {
        count++;
        size += fs.statSync(fullPath).size;
      }
    }
  }

  traverse(dir);
  return { count, size };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// 5. Test docker compose availability
function getDockerComposeCmd(): string {
  try {
    execSync("docker compose version", { stdio: "ignore" });
    return "docker compose";
  } catch {
    try {
      execSync("docker-compose version", { stdio: "ignore" });
      return "docker-compose";
    } catch {
      throw new Error("Neither 'docker compose' nor 'docker-compose' command was found. Please ensure Docker is running.");
    }
  }
}

// 6. Prune old backups
function pruneOldBackups(backupDir: string, keepCount: number, quiet: boolean) {
  if (!fs.existsSync(backupDir) || keepCount <= 0) return;

  const files = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith("seva_backup_") && f.endsWith(".zip"))
    .map((f) => ({
      name: f,
      fullPath: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length > keepCount) {
    const toRemove = files.slice(keepCount);
    for (const file of toRemove) {
      fs.unlinkSync(file.fullPath);
      if (!quiet) {
        console.log(`[PRUNE] Removed old backup: ${file.name}`);
      }
    }
  }
}

async function main() {
  const { outDir, keepCount, quiet } = parseArgs();
  const timestamp = getTimestamp();

  if (!quiet) {
    console.log("========================================================================");
    console.log("  SEVA MAINTENANCE SYSTEM - FULL SYSTEM BACKUP");
    console.log("========================================================================");
    console.log(`  Timestamp : ${timestamp}`);
    console.log(`  Database  : ${POSTGRES_DB} (User: ${POSTGRES_USER})`);
    console.log(`  Uploads   : ${UPLOADS_DIR}`);
    console.log(`  Output Dir: ${outDir}`);
    console.log("------------------------------------------------------------------------");
  }

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  const composeCmd = getDockerComposeCmd();

  // 1. Check if database container is online
  if (!quiet) console.log("[1/3] Verifying database connectivity & taking SQL dump...");
  
  let sqlDumpBuffer: Buffer;
  try {
    sqlDumpBuffer = execSync(
      `${composeCmd} exec -T db pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} --clean --if-exists`,
      { cwd: PROJECT_ROOT, maxBuffer: 500 * 1024 * 1024 }
    );
  } catch (err: any) {
    console.error("\n[ERROR] Failed to dump PostgreSQL database!");
    console.error("Please make sure the seva-db container is running: 'docker compose up -d db'\n");
    process.exit(1);
  }

  const sqlSizeBytes = sqlDumpBuffer.length;
  const sqlSha256 = crypto.createHash("sha256").update(sqlDumpBuffer).digest("hex");
  if (!quiet) {
    console.log(`  ✓ Database dumped successfully (${formatBytes(sqlSizeBytes)}, SHA-256: ${sqlSha256.slice(0, 16)}...)`);
  }

  // 2. Scan uploads directory
  if (!quiet) console.log("[2/3] Scanning uploaded files and assets...");
  const uploadStats = scanDirectory(UPLOADS_DIR);
  if (!quiet) {
    console.log(`  ✓ Uploads scanned: ${uploadStats.count} files (${formatBytes(uploadStats.size)})`);
  }

  // 3. Create Manifest
  const manifest = {
    appName: "Seva Maintenance Management System",
    version: "1.0.0",
    backupTimestamp: timestamp,
    createdAt: new Date().toISOString(),
    database: {
      dbName: POSTGRES_DB,
      dbUser: POSTGRES_USER,
      dumpFile: "database.sql",
      sizeBytes: sqlSizeBytes,
      sha256: sqlSha256,
    },
    uploads: {
      folder: "uploads",
      fileCount: uploadStats.count,
      totalSizeBytes: uploadStats.size,
    },
  };

  // 4. Create ZIP Archive
  const backupZipName = `seva_backup_${timestamp}.zip`;
  const backupZipPath = path.join(outDir, backupZipName);
  if (!quiet) console.log(`[3/3] Creating complete portable ZIP archive: ${backupZipName}...`);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(backupZipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);

    // Append manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

    // Append database dump
    archive.append(sqlDumpBuffer, { name: "database.sql" });

    // Append uploads directory if it exists and has content
    if (fs.existsSync(UPLOADS_DIR)) {
      archive.directory(UPLOADS_DIR, "uploads");
    }

    archive.finalize();
  });

  const finalZipSize = fs.statSync(backupZipPath).size;

  // 5. Prune old backups
  pruneOldBackups(outDir, keepCount, quiet);

  if (!quiet) {
    console.log("\n========================================================================");
    console.log("  [SUCCESS] COMPLETE BACKUP CREATED");
    console.log("========================================================================");
    console.log(`  Archive File : ${backupZipPath}`);
    console.log(`  Total Size   : ${formatBytes(finalZipSize)}`);
    console.log(`  Database     : ${formatBytes(sqlSizeBytes)} (${POSTGRES_DB})`);
    console.log(`  Assets       : ${uploadStats.count} files (${formatBytes(uploadStats.size)})`);
    console.log("------------------------------------------------------------------------");
    console.log("  To restore this backup at any time or on another server, run:");
    console.log(`    npm run restore -- "${backupZipPath}"`);
    console.log("========================================================================\n");
  } else {
    // If quiet mode (e.g. cron job), output just the path
    console.log(backupZipPath);
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR] Backup failed:", err);
  process.exit(1);
});
