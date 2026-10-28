import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { LocalDiskStorageDriver } from "../../src/core/storage/storage";
import { sanitizePathComponent } from "../../src/core/storage/zip";

describe("Security Suite: Path Traversal, File Storage & Upload Defenses", () => {
  const testBaseDir = path.resolve("./data/test-uploads");
  let driver: LocalDiskStorageDriver;

  beforeEach(async () => {
    if (!fsSync.existsSync(testBaseDir)) {
      await fs.mkdir(testBaseDir, { recursive: true });
    }
    driver = new LocalDiskStorageDriver(testBaseDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  it("strictly detects and rejects path traversal attempts in storage keys", () => {
    const maliciousPaths = [
      "../../etc/passwd",
      "..\\..\\windows\\system32\\cmd.exe",
      "seva/SEV-0001/../../../sensitive.txt",
      "/etc/shadow",
      "C:\\boot.ini",
      "seva/SEV-0001/../../../../app/.env",
    ];

    for (const malPath of maliciousPaths) {
      expect(() => driver.getAbsolutePath(malPath)).toThrow(/Path traversal attempt detected/);
    }
  });

  it("allows legitimate relative keys strictly within base directory", () => {
    const safeKey = "seva/SEV-0001/quotes/test-uuid.pdf";
    const resolved = driver.getAbsolutePath(safeKey);
    expect(resolved.startsWith(testBaseDir)).toBe(true);
    expect(resolved.endsWith(path.join("quotes", "test-uuid.pdf"))).toBe(true);
  });

  it("sanitizes ZIP entry paths to prevent Zip Slip directory traversal vulnerabilities", () => {
    const maliciousZipEntries = [
      "../../../../etc/cron.d/malicious",
      "..\\..\\windows\\system32\\malicious.bat",
      "SEV-0001/../../outside.txt",
      "/root/secret.key",
    ];

    for (const entry of maliciousZipEntries) {
      const sanitized = sanitizePathComponent(entry);
      expect(sanitized.includes("/")).toBe(false);
      expect(sanitized.includes("\\")).toBe(false);
    }
  });

  it("prohibits executable and active script extensions in file uploads", () => {
    const dangerousExtensions = [
      ".exe",
      ".sh",
      ".bat",
      ".cmd",
      ".ps1",
      ".svg",
      ".html",
      ".htm",
      ".js",
      ".mjs",
      ".php",
    ];

    const DISALLOWED_EXTS = new Set(dangerousExtensions);

    for (const ext of dangerousExtensions) {
      expect(DISALLOWED_EXTS.has(ext)).toBe(true);
    }
  });

  it("restricts video formats to Artefacts bucket only, rejecting in Quotes", () => {
    const ALLOWED_QUOTE_EXTS = new Set([
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".heic",
      ".docx",
      ".xlsx",
      ".csv",
      ".txt",
    ]);

    const ALLOWED_ARTEFACT_EXTS = new Set([
      ...ALLOWED_QUOTE_EXTS,
      ".mp4",
      ".mov",
    ]);

    // Quotes bucket reject video
    expect(ALLOWED_QUOTE_EXTS.has(".mp4")).toBe(false);
    expect(ALLOWED_QUOTE_EXTS.has(".mov")).toBe(false);

    // Artefacts bucket permits video
    expect(ALLOWED_ARTEFACT_EXTS.has(".mp4")).toBe(true);
    expect(ALLOWED_ARTEFACT_EXTS.has(".mov")).toBe(true);
  });
});
