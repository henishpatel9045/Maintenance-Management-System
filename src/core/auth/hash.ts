import bcrypt from "bcryptjs";

// Common password blacklist check (Section 17 requirement: min 10 chars + bundled common-password check)
const COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678901",
  "password123",
  "password1234",
  "admin12345",
  "administrator",
  "qwertyuiop",
  "welcome123",
  "changeme123",
  "letmein1234",
  "iloveyou123",
  "trustnoone1",
  "supersecret",
  "sunshine123",
  "princess123",
  "football123",
  "monkey12345",
  "shadow12345",
  "master12345",
  "dragon12345",
]);

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 10) {
    return { valid: false, message: "Password must be at least 10 characters long" };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, message: "Password is too common; choose a more secure passphrase" };
  }
  return { valid: true };
}

let argon2: typeof import("@node-rs/argon2") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  argon2 = require("@node-rs/argon2");
} catch {
  argon2 = null;
}

export async function hashPassword(password: string): Promise<string> {
  if (argon2) {
    try {
      return await argon2.hash(password, {
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        outputLen: 32,
        parallelism: 1,
        algorithm: 2, // Argon2id
      });
    } catch {
      // Fallback to bcrypt cost 12
    }
  }

  return bcrypt.hash(password, 12);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    if (hash.startsWith("$argon2") && argon2) {
      return await argon2.verify(hash, password);
    }
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
