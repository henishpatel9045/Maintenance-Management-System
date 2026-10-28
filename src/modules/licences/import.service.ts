import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { UserLicenceSource, UserLicenceStatus } from "@prisma/client";

export interface ParsedLicenceRow {
  rowNumber: number;
  data: {
    userEmail: string;
    licenceTypeCode: string;
    class?: string;
    licenceNumber?: string;
    issuer?: string;
    issuedAt?: string;
    expiresAt?: string;
    conditions?: string;
    notes?: string;
  };
  errors: string[];
  matchedUserId?: string;
  matchedUserName?: string;
  matchedLicenceTypeId?: string;
  matchedLicenceTypeName?: string;
  isValid: boolean;
}

export class LicenceImportService {
  /**
   * RFC-4180 compliant CSV parser.
   */
  public static parseCsv(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let insideQuotes = false;

    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(csvText)) {
      throw new AppError(400, "INVALID_CSV", "CSV file contains forbidden binary control characters.");
    }

    const text = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (insideQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentCell += '"';
            i++;
          } else {
            insideQuotes = false;
          }
        } else {
          currentCell += char;
        }
      } else {
        if (char === '"') {
          insideQuotes = true;
        } else if (char === ",") {
          currentRow.push(currentCell.trim());
          currentCell = "";
        } else if (char === "\n") {
          currentRow.push(currentCell.trim());
          if (currentRow.some((c) => c.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentCell = "";
        } else {
          currentCell += char;
        }
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Validates and previews a CSV import without committing.
   */
  public static async previewCsv(
    csvText: string,
    settings: Record<string, unknown> = {}
  ) {
    const maxMB = Number(settings["licenceImportMaxMB"] ?? 2);
    if (Buffer.byteLength(csvText, "utf-8") > maxMB * 1024 * 1024) {
      throw new AppError(400, "FILE_TOO_LARGE", `CSV file exceeds maximum allowed size of ${maxMB} MB.`);
    }

    const rawRows = this.parseCsv(csvText);
    if (rawRows.length < 2) {
      throw new AppError(400, "EMPTY_CSV", "CSV file must include a header row and at least one data row.");
    }

    const maxRows = Number(settings["licenceImportMaxRows"] ?? 2000);
    const dataRows = rawRows.slice(1);
    if (dataRows.length > maxRows) {
      throw new AppError(400, "ROW_LIMIT_EXCEEDED", `CSV exceeds the maximum allowed limit of ${maxRows} rows.`);
    }

    // Map headers
    const headerRow = rawRows[0]!.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_").trim());
    const emailIdx = headerRow.findIndex((h) => h.includes("email") || h === "user_email");
    const typeCodeIdx = headerRow.findIndex((h) => h.includes("type") || h.includes("code") || h === "licence_type");
    const classIdx = headerRow.findIndex((h) => h === "class" || h.includes("sub_type"));
    const numberIdx = headerRow.findIndex((h) => h.includes("number") || h === "licence_number");
    const issuerIdx = headerRow.findIndex((h) => h === "issuer" || h.includes("body"));
    const issuedAtIdx = headerRow.findIndex((h) => h.includes("issued") || h === "issue_date");
    const expiresAtIdx = headerRow.findIndex((h) => h.includes("expiry") || h.includes("expires") || h === "expiry_date");
    const conditionsIdx = headerRow.findIndex((h) => h.includes("condition"));
    const notesIdx = headerRow.findIndex((h) => h === "notes" || h.includes("comment"));

    if (emailIdx === -1) {
      throw new AppError(400, "MISSING_HEADER", 'Missing required column: "user_email"');
    }
    if (typeCodeIdx === -1) {
      throw new AppError(400, "MISSING_HEADER", 'Missing required column: "licence_type_code"');
    }

    // Pre-fetch all active users and licence types for rapid matching
    const [users, licenceTypes] = await Promise.all([
      db.user.findMany({
        where: { isActive: true },
        select: { id: true, email: true, name: true },
      }),
      db.licenceType.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, classes: true, issuer: true },
      }),
    ]);

    const userByEmail = new Map(
      users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u])
    );
    const typeByCode = new Map(licenceTypes.map((t) => [t.code.toLowerCase(), t]));

    const parsedRows: ParsedLicenceRow[] = [];
    let validCount = 0;
    let errorCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!;
      const rowNum = i + 2;
      const errors: string[] = [];

      const userEmail = (row[emailIdx] || "").trim().toLowerCase();
      const typeCode = (row[typeCodeIdx] || "").trim().toLowerCase();
      const licClass = classIdx !== -1 ? (row[classIdx] || "").trim() : undefined;
      const licenceNumber = numberIdx !== -1 ? (row[numberIdx] || "").trim() : undefined;
      const issuer = issuerIdx !== -1 ? (row[issuerIdx] || "").trim() : undefined;
      const issuedAt = issuedAtIdx !== -1 ? (row[issuedAtIdx] || "").trim() : undefined;
      const expiresAt = expiresAtIdx !== -1 ? (row[expiresAtIdx] || "").trim() : undefined;
      const conditions = conditionsIdx !== -1 ? (row[conditionsIdx] || "").trim() : undefined;
      const notes = notesIdx !== -1 ? (row[notesIdx] || "").trim() : undefined;

      // 1. Validate Email & Match User
      const matchedUser = userByEmail.get(userEmail);
      if (!userEmail) {
        errors.push("User email is required.");
      } else if (!matchedUser) {
        errors.push(`Unmatched user email: "${userEmail}" (user does not exist or is inactive).`);
      }

      // 2. Validate Licence Type
      const matchedType = typeByCode.get(typeCode);
      if (!typeCode) {
        errors.push("Licence type code is required.");
      } else if (!matchedType) {
        errors.push(`Unknown licence type code: "${typeCode}".`);
      }

      // 3. Validate Class if type defines classes
      if (matchedType && matchedType.classes.length > 0 && licClass) {
        const matchesClass = matchedType.classes.some(
          (c) => c.toLowerCase() === licClass.toLowerCase()
        );
        if (!matchesClass) {
          errors.push(`Invalid class "${licClass}" for ${matchedType.name}. Allowed classes: ${matchedType.classes.join(", ")}.`);
        }
      }

      // 4. Validate Dates
      if (issuedAt && isNaN(Date.parse(issuedAt))) {
        errors.push(`Invalid issued date format: "${issuedAt}". Use YYYY-MM-DD.`);
      }
      if (expiresAt && isNaN(Date.parse(expiresAt))) {
        errors.push(`Invalid expiry date format: "${expiresAt}". Use YYYY-MM-DD.`);
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else errorCount++;

      parsedRows.push({
        rowNumber: rowNum,
        data: {
          userEmail,
          licenceTypeCode: typeCode,
          class: licClass || undefined,
          licenceNumber: licenceNumber || undefined,
          issuer: issuer || undefined,
          issuedAt: issuedAt || undefined,
          expiresAt: expiresAt || undefined,
          conditions: conditions || undefined,
          notes: notes || undefined,
        },
        errors,
        matchedUserId: matchedUser?.id,
        matchedUserName: matchedUser?.name,
        matchedLicenceTypeId: matchedType?.id,
        matchedLicenceTypeName: matchedType?.name,
        isValid,
      });
    }

    return {
      totalRows: dataRows.length,
      validCount,
      errorCount,
      canCommit: errorCount === 0 && validCount > 0,
      rows: parsedRows,
    };
  }

  /**
   * Commits validated rows in an all-or-nothing transaction.
   */
  public static async commitImport(
    rows: ParsedLicenceRow["data"][],
    actorUserId: string
  ) {
    if (rows.length === 0) {
      throw new AppError(400, "NO_ROWS", "No rows provided for import.");
    }

    // Re-verify in transaction
    return await db.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { isActive: true },
        select: { id: true, email: true },
      });
      const userByEmail = new Map(
        users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id])
      );

      const types = await tx.licenceType.findMany({
        where: { isActive: true },
        select: { id: true, code: true, issuer: true },
      });
      const typeByCode = new Map(types.map((t) => [t.code.toLowerCase(), t]));

      const createdLicences = [];
      const now = new Date();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const userId = userByEmail.get(row.userEmail.toLowerCase());
        const type = typeByCode.get(row.licenceTypeCode.toLowerCase());

        if (!userId) {
          throw new AppError(400, "IMPORT_ERROR", `Row ${i + 1}: Unmatched user email "${row.userEmail}"`);
        }
        if (!type) {
          throw new AppError(400, "IMPORT_ERROR", `Row ${i + 1}: Unknown licence type code "${row.licenceTypeCode}"`);
        }

        const issuedAtDate = row.issuedAt ? new Date(row.issuedAt) : null;
        const expiresAtDate = row.expiresAt ? new Date(row.expiresAt) : null;

        // Derive status from expiry
        let status: UserLicenceStatus = UserLicenceStatus.VALID;
        if (expiresAtDate) {
          if (expiresAtDate < now) {
            status = UserLicenceStatus.EXPIRED;
          } else if (expiresAtDate.getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000) {
            status = UserLicenceStatus.EXPIRING_SOON;
          }
        }

        const licence = await tx.userLicence.create({
          data: {
            userId,
            licenceTypeId: type.id,
            class: row.class || null,
            licenceNumber: row.licenceNumber || null,
            issuer: row.issuer || type.issuer || null,
            issuedAt: issuedAtDate,
            expiresAt: expiresAtDate,
            conditions: row.conditions || null,
            notes: row.notes || null,
            status,
            source: UserLicenceSource.IMPORTED,
            verifiedById: actorUserId,
            verifiedAt: now,
            version: 1,
          },
        });
        createdLicences.push(licence);
      }

      await logAudit({
        entityType: "USER_LICENCE",
        entityId: "bulk_import",
        userId: actorUserId,
        action: "IMPORT_LICENCES",
        newValue: { importedCount: createdLicences.length },
      });

      return {
        success: true,
        importedCount: createdLicences.length,
      };
    });
  }

  /**
   * Generates a downloadable CSV import template.
   */
  public static getCsvTemplate(): string {
    const headers = [
      "user_email",
      "licence_type_code",
      "class",
      "licence_number",
      "issuer",
      "issued_at",
      "expires_at",
      "conditions",
      "notes",
    ];

    const sampleRows = [
      "aarav@seva.local,forklift,LF,LF-SA-123456,SafeWork SA,2025-01-15,2030-01-15,Standard restrictions,Imported from legacy records",
      "priya@seva.local,white-card,,CGC-SA-98765,SafeWork Australia,2024-05-10,,General construction induction,",
      "vikram@seva.local,ewp,over 11m,EWP-998877,EWPA,2025-03-20,2030-03-20,,Boom and scissor lift ticket",
    ];

    return `${headers.join(",")}\n${sampleRows.join("\n")}\n`;
  }
}
