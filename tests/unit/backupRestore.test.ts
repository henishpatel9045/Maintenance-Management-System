import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import archiver from "archiver";
import unzipper from "unzipper";

describe("Backup & Restore Archive Integrity", () => {
  const testDir = path.join(process.cwd(), ".tmp_test_backup");
  const uploadsSource = path.join(testDir, "source_uploads");
  const zipOutputPath = path.join(testDir, "test_backup.zip");
  const restoreExtractDir = path.join(testDir, "extracted");

  beforeEach(() => {
    fs.mkdirSync(uploadsSource, { recursive: true });
    fs.mkdirSync(restoreExtractDir, { recursive: true });

    // Seed dummy files into uploads
    fs.writeFileSync(path.join(uploadsSource, "quote.pdf"), "%PDF-1.4 sample quote");
    fs.mkdirSync(path.join(uploadsSource, "seva", "SEV-001"), { recursive: true });
    fs.writeFileSync(path.join(uploadsSource, "seva", "SEV-001", "photo.webp"), "image-bytes-sample");
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("packages database dump, assets, and manifest into a single ZIP, then extracts cleanly", async () => {
    const dummySql = "-- Dummy SQL Dump\nCREATE TABLE test_table (id text);\nINSERT INTO test_table VALUES ('val-1');\n";
    const sqlSha256 = crypto.createHash("sha256").update(dummySql).digest("hex");

    const manifest = {
      appName: "Seva Maintenance Management System",
      version: "1.0.0",
      backupTimestamp: "20261028_170000",
      database: {
        dbName: "seva_maintenance",
        dumpFile: "database.sql",
        sha256: sqlSha256,
      },
      uploads: {
        folder: "uploads",
        fileCount: 2,
      },
    };

    // 1. Create backup archive
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipOutputPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      archive.on("error", (err) => reject(err));

      archive.pipe(output);
      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
      archive.append(dummySql, { name: "database.sql" });
      archive.directory(uploadsSource, "uploads");
      archive.finalize();
    });

    expect(fs.existsSync(zipOutputPath)).toBe(true);
    expect(fs.statSync(zipOutputPath).size).toBeGreaterThan(0);

    // 2. Extract and restore
    const directory = await unzipper.Open.file(zipOutputPath);
    await directory.extract({ path: restoreExtractDir });

    // 3. Verify extracted contents
    const extractedManifestPath = path.join(restoreExtractDir, "manifest.json");
    const extractedSqlPath = path.join(restoreExtractDir, "database.sql");
    const extractedQuotePath = path.join(restoreExtractDir, "uploads", "quote.pdf");
    const extractedPhotoPath = path.join(restoreExtractDir, "uploads", "seva", "SEV-001", "photo.webp");

    expect(fs.existsSync(extractedManifestPath)).toBe(true);
    expect(fs.existsSync(extractedSqlPath)).toBe(true);
    expect(fs.existsSync(extractedQuotePath)).toBe(true);
    expect(fs.existsSync(extractedPhotoPath)).toBe(true);

    const extractedSql = fs.readFileSync(extractedSqlPath, "utf8");
    expect(extractedSql).toBe(dummySql);

    const extractedSha256 = crypto.createHash("sha256").update(extractedSql).digest("hex");
    expect(extractedSha256).toBe(sqlSha256);

    const extractedManifest = JSON.parse(fs.readFileSync(extractedManifestPath, "utf8"));
    expect(extractedManifest.database.sha256).toBe(sqlSha256);
    expect(extractedManifest.uploads.fileCount).toBe(2);

    expect(fs.readFileSync(extractedQuotePath, "utf8")).toBe("%PDF-1.4 sample quote");
    expect(fs.readFileSync(extractedPhotoPath, "utf8")).toBe("image-bytes-sample");
  });
});
