#!/usr/bin/env node
/**
 * Seva Maintenance Management System - Password Recovery CLI
 * 
 * Allows emergency reset of any account password (especially ADMIN)
 * without requiring the current or previous password.
 * 
 * Usage:
 *   # Interactive mode:
 *   npm run reset-password
 * 
 *   # Non-interactive CLI flag mode:
 *   npm run reset-password -- --email admin@seva.local --password "NewSecurePass123"
 *   npm run reset-password -- -e admin@seva.local
 *   npm run reset-password -- --list
 * 
 *   # Inside Docker container:
 *   docker compose exec app npm run reset-password
 *   # or
 *   docker compose exec app npx tsx scripts/reset-password.ts -e admin@seva.local
 */

import fs from "fs";
import path from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

// 1. Ensure .env is loaded in standalone/direct execution
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const idx = trimmed.indexOf("=");
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // Ignore error, will fail on db connection if DATABASE_URL is missing
  }
}

import { db } from "../src/core/db";
import { hashPassword, validatePasswordStrength } from "../src/core/auth/hash";
import { logAudit } from "../src/core/audit/audit";

function generateSecurePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `Seva-${pick(4)}-${pick(4)}-${pick(4)}`;
}

function parseCliArgs(args: string[]) {
  const parsed: {
    email?: string;
    password?: string;
    forceChange?: boolean;
    list?: boolean;
    help?: boolean;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--email" || arg === "-e") {
      parsed.email = args[++i];
    } else if (arg === "--password" || arg === "-p") {
      parsed.password = args[++i];
    } else if (arg === "--force-change" || arg === "--must-change") {
      parsed.forceChange = true;
    } else if (arg === "--no-force-change" || arg === "--no-must-change") {
      parsed.forceChange = false;
    } else if (arg === "--list" || arg === "-l") {
      parsed.list = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`
========================================================================
  SEVA MAINTENANCE SYSTEM - PASSWORD RECOVERY CLI
========================================================================

Description:
  Emergency password reset tool for Administrators, Coordinators, and
  Members. Can be executed from the host terminal or inside Docker container
  without requiring the previous password.

Usage:
  npm run reset-password [options]
  npx tsx scripts/reset-password.ts [options]

Options:
  -e, --email <email>         Target user or administrator email address
  -p, --password <password>   New password (min 10 chars). If omitted,
                              a high-entropy password will be generated.
  --force-change              Require user to change password on next login
  --no-force-change           Allow direct login without forced change (default)
  -l, --list                  List all users and their roles
  -h, --help                  Show this help message

Examples:
  # Interactive mode:
  npm run reset-password

  # Reset admin password with auto-generated secure password:
  npm run reset-password -- -e admin@seva.local

  # Reset admin password with custom password:
  npm run reset-password -- -e admin@seva.local -p "MySuperSecretPassword2026!"

  # Reset inside Docker container:
  docker compose exec app npm run reset-password -- -e admin@seva.local
`);
}

async function listUsers() {
  console.log("\nFetching accounts from database...\n");
  const users = await db.user.findMany({
    include: { role: true },
    orderBy: [{ role: { name: "asc" } }, { name: "asc" }],
  });

  if (users.length === 0) {
    console.log("No users found in database.");
    return;
  }

  console.log("--------------------------------------------------------------------------------------");
  console.log(
    `${"Name".padEnd(25)} | ${"Role".padEnd(12)} | ${"Status".padEnd(10)} | ${"Email".padEnd(30)}`
  );
  console.log("--------------------------------------------------------------------------------------");

  for (const u of users) {
    const roleName = u.role?.name || "UNKNOWN";
    const status = u.isActive ? "Active" : "Deactivated";
    const email = u.email || "(no email)";
    console.log(
      `${u.name.slice(0, 24).padEnd(25)} | ${roleName.padEnd(12)} | ${status.padEnd(10)} | ${email.padEnd(30)}`
    );
  }
  console.log("--------------------------------------------------------------------------------------\n");
}

async function performReset(targetEmail: string, newPassword: string, forceChange: boolean) {
  const emailClean = targetEmail.trim().toLowerCase();

  // Find user
  const user = await db.user.findFirst({
    where: {
      email: {
        equals: emailClean,
        mode: "insensitive",
      },
    },
    include: { role: true },
  });

  if (!user) {
    console.error(`\n[ERROR] No account found with email: "${targetEmail}"\n`);
    process.exit(1);
  }

  // Validate password strength
  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    console.error(`\n[ERROR] Password rejected: ${strength.message || "Password does not meet complexity requirements"}\n`);
    process.exit(1);
  }

  console.log(`\nProcessing password reset for: ${user.name} (${user.email || "No email"})...`);

  // Hash new password
  const newHash = await hashPassword(newPassword);

  // Update DB & ensure account is active
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: forceChange,
      isActive: true, // Auto-activate if locked out
    },
  });

  // Revoke all active sessions
  const deletedSessions = await db.session.deleteMany({
    where: { userId: user.id },
  });

  // Log audit
  await logAudit({
    entityType: "USER",
    entityId: user.id,
    userId: null,
    action: "RESET_PASSWORD_CLI",
    newValue: {
      email: user.email,
      role: user.role.name,
      mustChangePassword: forceChange,
      revokedSessionsCount: deletedSessions.count,
    },
  });

  // Output success banner
  console.log("\n========================================================================");
  console.log(" [SUCCESS] PASSWORD RESET COMPLETED");
  console.log("========================================================================");
  console.log(` User Account  : ${user.name}`);
  console.log(` Email Address : ${user.email}`);
  console.log(` Role          : ${user.role.name}`);
  console.log(` Account Status: Active`);
  console.log(` New Password  : ${newPassword}`);
  console.log(` Forced Change : ${forceChange ? "Yes (Must change on next login)" : "No (Can log in directly)"}`);
  console.log(` Revoked Sessions: ${deletedSessions.count} active session(s) terminated`);
  console.log("========================================================================");
  console.log("\nYou can now sign in immediately at the web console:");
  console.log("   URL: http://localhost:8080/login\n");
}

async function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));

  if (cliArgs.help) {
    printHelp();
    process.exit(0);
  }

  if (cliArgs.list) {
    await listUsers();
    process.exit(0);
  }

  // If email was provided via CLI flag
  if (cliArgs.email) {
    const password = cliArgs.password || generateSecurePassword();
    const forceChange = cliArgs.forceChange ?? false;
    await performReset(cliArgs.email, password, forceChange);
    process.exit(0);
  }

  // Interactive Mode
  console.log(`
========================================================================
  SEVA MAINTENANCE SYSTEM - EMERGENCY PASSWORD RECOVERY
========================================================================
`);

  // Fetch admin accounts to show quick pick list
  const adminUsers = await db.user.findMany({
    where: {
      role: { name: "ADMIN" },
    },
    include: { role: true },
    orderBy: { name: "asc" },
  });

  const rl = readline.createInterface({ input, output });

  try {
    let chosenEmail = "";

    if (adminUsers.length > 0) {
      console.log("Existing System Administrator Accounts:");
      adminUsers.forEach((admin, idx) => {
        console.log(`  [${idx + 1}] ${admin.email} (${admin.name})`);
      });
      console.log(`  [m] Enter another email (Coordinator, Member, etc.)`);
      console.log(`  [l] List all users in system`);
      console.log(`  [q] Quit\n`);

      const selection = (await rl.question("Select an option [1-" + adminUsers.length + ", m, l, q]: ")).trim();

      if (selection.toLowerCase() === "q") {
        console.log("Operation cancelled.");
        rl.close();
        process.exit(0);
      }

      if (selection.toLowerCase() === "l") {
        await listUsers();
        chosenEmail = (await rl.question("Enter the target account email: ")).trim();
      } else {
        const num = parseInt(selection, 10);
        if (!isNaN(num) && num >= 1 && num <= adminUsers.length) {
          const selected = adminUsers[num - 1];
          if (selected?.email) {
            chosenEmail = selected.email;
          }
        } else if (selection.toLowerCase() === "m" || selection.includes("@")) {
          if (selection.includes("@")) {
            chosenEmail = selection;
          } else {
            chosenEmail = (await rl.question("Enter the target account email: ")).trim();
          }
        }
      }
    } else {
      chosenEmail = (await rl.question("Enter the account email to reset: ")).trim();
    }

    if (!chosenEmail) {
      console.error("[ERROR] No email provided. Aborting.");
      rl.close();
      process.exit(1);
    }

    const customPass = (
      await rl.question(
        "\nEnter new password (min 10 chars, or press Enter to auto-generate a secure password): "
      )
    ).trim();

    const password = customPass || generateSecurePassword();

    const forceChangeAnswer = (
      await rl.question("Require password change upon next login? (y/N, default: N): ")
    )
      .trim()
      .toLowerCase();

    const forceChange = forceChangeAnswer === "y" || forceChangeAnswer === "yes";

    rl.close();

    await performReset(chosenEmail, password, forceChange);
  } catch (err) {
    rl.close();
    console.error("[ERROR] Password reset failed:", err);
    process.exit(1);
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[FATAL ERROR]:", err);
  process.exit(1);
});
