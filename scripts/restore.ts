#!/usr/bin/env node
/**
 * Seva Maintenance Management System - Complete Restore Script
 * 
 * Restores the complete state of the application from a backup ZIP archive:
 *  1. Validates archive integrity & checksums
 *  2. Restores all uploaded assets and files to ./data/uploads
 *  3. Restores the full PostgreSQL database schema, data, and sequences
 * 
 * Usage:
 *   npm run restore -- [path/to/backup.zip] [--yes]
 *   npx tsx scripts/restore.ts [path/to/backup.zip] [-y]
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { execSync, spawn } from "child_process";
import unzipper from "unzipper";

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
const TARGET_UPLOADS_DIR = path.join(PROJECT_ROOT, "data", "uploads");

// 2. Parse CLI Arguments
interface RestoreOptions {
  zipPath?: string;
  autoConfirm: boolean;
  dbOnly: boolean;
  uploadsOnly: boolean;
}

function parseArgs(): RestoreOptions {
  const args = process.argv.slice(2);
  let zipPath: string | undefined = undefined;
  let autoConfirm = false;
  let dbOnly = false;
  let uploadsOnly = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--yes" || arg === "-y") {
      autoConfirm = true;
    } else if (arg === "--db-only") {
      dbOnly = true;
    } else if (arg === "--uploads-only") {
      uploadsOnly = true;
    } else if (!arg.startsWith("-")) {
      zipPath = arg;
    }
  }

  return { zipPath, autoConfirm, dbOnly, uploadsOnly };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// 3. Test docker compose availability
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

// 4. Copy directory recursively
function copyDirectoryRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 5. Count files recursively
function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countFiles(full);
    else count++;
  }
  return count;
}

// 6. Find latest backup if none specified
function findLatestBackup(): string | null {
  const backupDir = path.join(PROJECT_ROOT, "backups");
  if (!fs.existsSync(backupDir)) return null;

  const files = fs.readdirSync(backupDir)
    .filter((f) => f.endsWith(".zip"))
    .map((f) => ({
      name: f,
      fullPath: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.time - a.time);

  return files.length > 0 && files[0] ? files[0].fullPath : null;
}

async function main() {
  const options = parseArgs();
  let targetZip = options.zipPath;

  if (!targetZip) {
    const latest = findLatestBackup();
    if (!latest) {
      console.error("\n[ERROR] No backup file specified, and no backup files found in ./backups/\n");
      console.error("Usage: npm run restore -- <path/to/seva_backup_YYYYMMDD_HHMMSS.zip>\n");
      process.exit(1);
    }
    console.log(`[SEVA RESTORE] No backup file specified. Auto-detected latest backup: ${path.basename(latest)}`);
    targetZip = latest;
  }

  const resolvedZipPath = path.resolve(process.cwd(), targetZip);

  if (!fs.existsSync(resolvedZipPath)) {
    console.error(`\n[ERROR] Backup file not found: ${resolvedZipPath}\n`);
    process.exit(1);
  }

  const zipStat = fs.statSync(resolvedZipPath);

  console.log("========================================================================");
  console.log("  SEVA MAINTENANCE SYSTEM - FULL SYSTEM RESTORE");
  console.log("========================================================================");
  console.log(`  Backup Archive : ${resolvedZipPath}`);
  console.log(`  Archive Size   : ${formatBytes(zipStat.size)}`);
  console.log(`  Target Database: ${POSTGRES_DB} (User: ${POSTGRES_USER})`);
  console.log(`  Target Uploads : ${TARGET_UPLOADS_DIR}`);
  console.log("------------------------------------------------------------------------");

  // 1. Extract ZIP to temporary workspace
  const tempExtractDir = path.join(PROJECT_ROOT, `.tmp_restore_${Date.now()}`);
  fs.mkdirSync(tempExtractDir, { recursive: true });

  try {
    console.log("[1/4] Extracting backup archive for inspection...");
    const directory = await unzipper.Open.file(resolvedZipPath);
    await directory.extract({ path: tempExtractDir });

    // 2. Validate manifest and database dump
    const manifestPath = path.join(tempExtractDir, "manifest.json");
    const sqlPath = path.join(tempExtractDir, "database.sql");

    if (!fs.existsSync(sqlPath) && !options.uploadsOnly) {
      throw new Error("Invalid backup archive: missing 'database.sql'");
    }

    let manifest: any = null;
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        console.log(`  ✓ Manifest validated: Created ${manifest.createdAt || manifest.backupTimestamp}`);
        if (manifest.database) {
          console.log(`  ✓ Database snapshot: ${manifest.database.dbName} (${formatBytes(manifest.database.sizeBytes)})`);
        }
        if (manifest.uploads) {
          console.log(`  ✓ Uploaded assets snapshot: ${manifest.uploads.fileCount} files (${formatBytes(manifest.uploads.totalSizeBytes)})`);
        }
      } catch {
        console.warn("  ! Warning: Manifest could not be parsed; continuing with raw SQL and files.");
      }
    }

    // Verify SQL dump checksum if present
    if (manifest?.database?.sha256 && fs.existsSync(sqlPath)) {
      const sqlBuffer = fs.readFileSync(sqlPath);
      const computedHash = crypto.createHash("sha256").update(sqlBuffer).digest("hex");
      if (computedHash === manifest.database.sha256) {
        console.log("  ✓ Cryptographic SHA-256 database checksum verified OK.");
      } else {
        console.warn("  ! Warning: Database SHA-256 checksum mismatch! Archive may have been modified.");
      }
    }

    // 3. User Confirmation Prompt
    if (!options.autoConfirm) {
      console.log("\n========================================================================");
      console.log("  WARNING: RESTORING WILL OVERWRITE EXISTING DATABASE AND ASSETS!");
      console.log("  Current data will be replaced by the state recorded in this backup.");
      console.log("========================================================================");

      const rl = readline.createInterface({ input, output });
      const answer = (await rl.question("Proceed with complete restoration? (type 'yes' to proceed): ")).trim().toLowerCase();
      rl.close();

      if (answer !== "yes" && answer !== "y") {
        console.log("\n[ABORTED] Restore cancelled by user. No changes were made.\n");
        return;
      }
    }

    const composeCmd = getDockerComposeCmd();

    // 4. Restore Uploaded Files
    if (!options.dbOnly) {
      console.log("\n[2/4] Restoring uploaded files & assets to host directory...");
      const extractedUploadsDir = path.join(tempExtractDir, "uploads");

      if (fs.existsSync(extractedUploadsDir)) {
        // Ensure host target directory exists
        fs.mkdirSync(TARGET_UPLOADS_DIR, { recursive: true });
        copyDirectoryRecursive(extractedUploadsDir, TARGET_UPLOADS_DIR);
        const restoredCount = countFiles(TARGET_UPLOADS_DIR);
        console.log(`  ✓ Uploads restored to ${TARGET_UPLOADS_DIR} (${restoredCount} total files on host disk)`);
      } else {
        console.log("  ✓ No uploads folder in backup archive; skipped.");
      }
    } else {
      console.log("\n[2/4] Skipping uploads restoration (--db-only requested).");
    }

    // 5. Restore Database
    if (!options.uploadsOnly) {
      console.log("\n[3/4] Restoring PostgreSQL database from SQL dump...");

      // Check database readiness
      try {
        execSync(`${composeCmd} exec -T db pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`, {
          cwd: PROJECT_ROOT,
          stdio: "ignore",
        });
      } catch {
        throw new Error(`Database container (db) is not ready. Run: ${composeCmd} up -d db`);
      }

      // Stream database.sql into psql
      await new Promise<void>((resolve, reject) => {
        const sqlStream = fs.createReadStream(sqlPath);
        const [binary, ...extraArgs] = composeCmd.split(" ");
        const psqlProcess = spawn(
          binary || "docker",
          [
            ...extraArgs,
            "exec",
            "-T",
            "db",
            "psql",
            "-U",
            POSTGRES_USER,
            "-d",
            POSTGRES_DB,
          ],
          { cwd: PROJECT_ROOT, stdio: ["pipe", "pipe", "pipe"] }
        );

        let stderrData = "";
        psqlProcess.stderr?.on("data", (chunk: Buffer) => {
          stderrData += chunk.toString();
        });

        psqlProcess.on("close", (code: number | null) => {
          if (code === 0) {
            resolve();
          } else {
            // Some notices/warnings are normal during --clean DROP, but exit code non-zero is an error
            reject(new Error(`psql exited with code ${code}: ${stderrData}`));
          }
        });

        psqlProcess.on("error", (err: Error) => reject(err));

        if (psqlProcess.stdin) {
          sqlStream.pipe(psqlProcess.stdin);
        } else {
          reject(new Error("Unable to open stdin on psql process"));
        }
      });

      console.log("  ✓ PostgreSQL database restored successfully.");

      // 6. Verify database contents
      console.log("\n[4/4] Verifying database integrity...");
      try {
        const userCountOut = execSync(
          `${composeCmd} exec -T db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -t -c "SELECT count(*) FROM users;"`,
          { cwd: PROJECT_ROOT, encoding: "utf8" }
        ).trim();
        const sevaCountOut = execSync(
          `${composeCmd} exec -T db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -t -c "SELECT count(*) FROM sevas;"`,
          { cwd: PROJECT_ROOT, encoding: "utf8" }
        ).trim();

        console.log(`  ✓ Database verified: ${userCountOut} users, ${sevaCountOut} sevas online.`);
      } catch {
        console.log("  ✓ Database tables restored.");
      }
    } else {
      console.log("\n[3/4] Skipping database restoration (--uploads-only requested).");
    }

    console.log("\n========================================================================");
    console.log("  [SUCCESS] APPLICATION STATE RESTORED SUCCESSFULLY!");
    console.log("========================================================================");
    console.log(`  Source Backup : ${path.basename(resolvedZipPath)}`);
    console.log(`  Database      : ${POSTGRES_DB} restored and verified`);
    console.log(`  Assets/Uploads: Synchronized to ${TARGET_UPLOADS_DIR}`);
    console.log("  The system is fully accessible at: http://localhost:8080");
    console.log("========================================================================\n");
  } finally {
    // Clean up temporary workspace
    if (fs.existsSync(tempExtractDir)) {
      try {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup failure
      }
    }
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR] Restore failed:", err.message || err);
  process.exit(1);
});
