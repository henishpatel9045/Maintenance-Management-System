import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { generateContractorCode } from "./code";
import { validateAbnChecksum, normalizeAbn, normalizeAustralianPhone, containsPaymentCard } from "./validation";
import { Prisma } from "@prisma/client";

export interface ParsedCsvRow {
  rowNumber: number;
  data: {
    companyName: string;
    tradingName?: string;
    registrationType?: string;
    registrationNumber?: string;
    gstRegistered?: boolean;
    trades?: string[];
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    addressLine1?: string;
    addressLine2?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    country?: string;
    website?: string;
    mainPhone?: string;
    mainEmail?: string;
    afterHoursAvailable?: boolean;
    emergencyPhone?: string;
    paymentTerms?: string;
    callOutFee?: number;
    hourlyRate?: number;
    internalNotes?: string;
  };
  errors: string[];
  duplicateMatches: Array<{
    contractorId: string;
    code: string;
    companyName: string;
    matchType: "REGISTRATION_NUMBER" | "SIMILAR_NAME";
  }>;
  isValid: boolean;
}

export class ImportService {
  /**
   * RFC-4180 compliant safe CSV parser.
   * Handles quoted cells, escaped quotes, embedded commas, newlines, CRLF.
   */
  public static parseCsv(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let insideQuotes = false;

    // Check for binary content
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(csvText)) {
      throw new AppError(400, "INVALID_CSV", "CSV file contains forbidden binary control characters.");
    }

    let i = 0;
    while (i < csvText.length) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          insideQuotes = !insideQuotes;
          i++;
          continue;
        }
      }

      if (!insideQuotes) {
        if (char === ",") {
          currentRow.push(currentCell.trim());
          currentCell = "";
          i++;
          continue;
        }

        if (char === "\r" || char === "\n") {
          if (char === "\r" && nextChar === "\n") {
            i++;
          }
          currentRow.push(currentCell.trim());
          currentCell = "";

          // Only push non-empty rows
          if (currentRow.some((c) => c.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          i++;
          continue;
        }
      }

      currentCell += char;
      i++;
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
   * Preview a CSV import: validates limits, schema, phone & ABN normalisation,
   * card Luhn checks, and duplicate detection.
   */
  public static async preview(csvContent: string) {
    // 1. Fetch settings for limits
    const [maxRowsSetting, maxMBSetting] = await Promise.all([
      db.setting.findUnique({ where: { key: "contractorImportMaxRows" } }),
      db.setting.findUnique({ where: { key: "contractorImportMaxMB" } }),
    ]);

    const maxRows = typeof maxRowsSetting?.value === "number" ? maxRowsSetting.value : 2000;
    const maxMB = typeof maxMBSetting?.value === "number" ? maxMBSetting.value : 2;

    const byteLength = Buffer.byteLength(csvContent, "utf8");
    if (byteLength > maxMB * 1024 * 1024) {
      throw new AppError(
        400,
        "FILE_TOO_LARGE",
        `CSV file exceeds maximum allowed size of ${maxMB} MB (file size: ${(byteLength / 1024 / 1024).toFixed(2)} MB)`
      );
    }

    const rawRows = this.parseCsv(csvContent);
    if (rawRows.length < 2) {
      throw new AppError(400, "EMPTY_CSV", "CSV file must contain a header row and at least one data row.");
    }

    const dataRows = rawRows.slice(1);
    if (dataRows.length > maxRows) {
      throw new AppError(
        400,
        "ROW_LIMIT_EXCEEDED",
        `CSV file exceeds maximum allowed rows of ${maxRows} (file rows: ${dataRows.length})`
      );
    }

    const headerRow = rawRows[0] || [];
    const headers = headerRow.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const headerMap = new Map<string, number>();
    headers.forEach((h, idx) => headerMap.set(h, idx));

    const getVal = (row: string[], ...aliases: string[]): string | undefined => {
      for (const a of aliases) {
        const colIdx = headerMap.get(a.toLowerCase().replace(/[^a-z0-9]/g, ""));
        if (colIdx !== undefined && row[colIdx] !== undefined && row[colIdx].length > 0) {
          return row[colIdx];
        }
      }
      return undefined;
    };

    const parsedRows: ParsedCsvRow[] = [];
    const seenRegNumbersInCsv = new Set<string>();

    for (let idx = 0; idx < dataRows.length; idx++) {
      const row = dataRows[idx];
      if (!row) continue;
      const rowNum = idx + 2; // 1-based, skipping header
      const errors: string[] = [];

      const companyName = getVal(row, "companyName", "company", "name");
      if (!companyName || companyName.trim().length === 0) {
        errors.push("Company Name is required.");
      }

      const tradingName = getVal(row, "tradingName", "trading");
      const registrationType = getVal(row, "registrationType", "regType") || "ABN";
      let registrationNumber = getVal(row, "registrationNumber", "abn", "acn", "regNumber");

      // Validate and normalize ABN if ABN registrationType
      if (registrationNumber) {
        if (registrationType.toUpperCase() === "ABN") {
          registrationNumber = normalizeAbn(registrationNumber) || registrationNumber;
          if (!validateAbnChecksum(registrationNumber)) {
            errors.push(`Invalid Australian ABN checksum for "${registrationNumber}".`);
          }
        }
      }

      // Check duplicate within the CSV itself
      if (registrationNumber) {
        const dedupeKey = `${registrationType.toUpperCase()}_${registrationNumber}`;
        if (seenRegNumbersInCsv.has(dedupeKey)) {
          errors.push(`Duplicate registration number "${registrationNumber}" found earlier in this CSV file.`);
        } else {
          seenRegNumbersInCsv.add(dedupeKey);
        }
      }

      // Phones normalization
      let mainPhone = getVal(row, "mainPhone", "phone");
      if (mainPhone) {
        mainPhone = normalizeAustralianPhone(mainPhone) || mainPhone;
      }

      let emergencyPhone = getVal(row, "emergencyPhone", "emergency");
      if (emergencyPhone) {
        emergencyPhone = normalizeAustralianPhone(emergencyPhone) || emergencyPhone;
      }

      let contactPhone = getVal(row, "contactPhone");
      if (contactPhone) {
        contactPhone = normalizeAustralianPhone(contactPhone) || contactPhone;
      }

      // Card Luhn check on free-text fields
      const internalNotes = getVal(row, "internalNotes", "notes");
      if (internalNotes && containsPaymentCard(internalNotes)) {
        errors.push("Payment card details detected in internal notes. Storing credit/debit card numbers is strictly prohibited.");
      }

      const paymentTerms = getVal(row, "paymentTerms", "terms");
      if (paymentTerms && containsPaymentCard(paymentTerms)) {
        errors.push("Payment card details detected in payment terms. Storing credit/debit card numbers is strictly prohibited.");
      }

      // Trades parsing (comma or semicolon delimited)
      const tradesRaw = getVal(row, "trades", "trade");
      const trades = tradesRaw
        ? tradesRaw.split(/[;,]/).map((t) => t.trim()).filter((t) => t.length > 0)
        : [];

      // Fee parsing
      let callOutFee: number | undefined;
      const callOutRaw = getVal(row, "callOutFee", "callout");
      if (callOutRaw) {
        const parsed = Number(callOutRaw.replace(/[^0-9.]/g, ""));
        if (isNaN(parsed)) errors.push("Call out fee must be a valid number.");
        else callOutFee = parsed;
      }

      let hourlyRate: number | undefined;
      const rateRaw = getVal(row, "hourlyRate", "rate");
      if (rateRaw) {
        const parsed = Number(rateRaw.replace(/[^0-9.]/g, ""));
        if (isNaN(parsed)) errors.push("Hourly rate must be a valid number.");
        else hourlyRate = parsed;
      }

      // Check duplicates against DB
      const duplicateMatches: ParsedCsvRow["duplicateMatches"] = [];
      if (registrationNumber) {
        const match = await db.contractor.findFirst({
          where: {
            registrationNumber,
            registrationType,
            archivedAt: null,
          },
          select: { id: true, code: true, companyName: true },
        });
        if (match) {
          duplicateMatches.push({
            contractorId: match.id,
            code: match.code,
            companyName: match.companyName,
            matchType: "REGISTRATION_NUMBER",
          });
        }
      }

      if (companyName && companyName.trim().length > 2) {
        const simMatches = await db.$queryRaw<Array<{ id: string; code: string; company_name: string; sim: number }>>(
          Prisma.sql`
            SELECT id, code, company_name, similarity(company_name, ${companyName.trim()}) as sim
            FROM contractors
            WHERE archived_at IS NULL AND (company_name % ${companyName.trim()} OR similarity(company_name, ${companyName.trim()}) > 0.6)
            LIMIT 2
          `
        );
        for (const sm of simMatches) {
          if (!duplicateMatches.some((d) => d.contractorId === sm.id)) {
            duplicateMatches.push({
              contractorId: sm.id,
              code: sm.code,
              companyName: sm.company_name,
              matchType: "SIMILAR_NAME",
            });
          }
        }
      }

      const gstRegisteredStr = getVal(row, "gstRegistered", "gst");
      const gstRegistered = gstRegisteredStr
        ? !["false", "0", "no", "n"].includes(gstRegisteredStr.toLowerCase())
        : true;

      const afterHoursStr = getVal(row, "afterHoursAvailable", "afterhours");
      const afterHoursAvailable = afterHoursStr
        ? ["true", "1", "yes", "y"].includes(afterHoursStr.toLowerCase())
        : false;

      parsedRows.push({
        rowNumber: rowNum,
        data: {
          companyName: companyName || "",
          tradingName,
          registrationType,
          registrationNumber,
          gstRegistered,
          trades,
          contactName: getVal(row, "contactName", "contact"),
          contactPhone,
          contactEmail: getVal(row, "contactEmail"),
          addressLine1: getVal(row, "addressLine1", "address"),
          addressLine2: getVal(row, "addressLine2"),
          suburb: getVal(row, "suburb", "city"),
          state: getVal(row, "state"),
          postcode: getVal(row, "postcode", "zip"),
          country: getVal(row, "country") || "AU",
          website: getVal(row, "website"),
          mainPhone,
          mainEmail: getVal(row, "mainEmail", "email"),
          afterHoursAvailable,
          emergencyPhone,
          paymentTerms,
          callOutFee,
          hourlyRate,
          internalNotes,
        },
        errors,
        duplicateMatches,
        isValid: errors.length === 0,
      });
    }

    const validRows = parsedRows.filter((r) => r.isValid && r.duplicateMatches.length === 0).length;
    const invalidRows = parsedRows.filter((r) => !r.isValid).length;
    const duplicatesCount = parsedRows.filter((r) => r.duplicateMatches.length > 0).length;

    return {
      headers: rawRows[0],
      totalRows: parsedRows.length,
      validRows,
      invalidRows,
      duplicatesCount,
      rows: parsedRows,
    };
  }

  /**
   * Commit verified CSV rows in an all-or-nothing database transaction.
   */
  public static async commit(
    csvContent: string,
    updateMatchedRecords: boolean,
    userId: string
  ) {
    const preview = await this.preview(csvContent);

    if (preview.invalidRows > 0) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        `Cannot commit import with ${preview.invalidRows} invalid row(s). Please fix the errors and try again.`
      );
    }

    if (!updateMatchedRecords && preview.duplicatesCount > 0) {
      throw new AppError(
        400,
        "DUPLICATES_DETECTED",
        `Found ${preview.duplicatesCount} duplicate contractor(s). Please enable "update matched records" or remove duplicate rows.`
      );
    }

    // Load master trades for lookup
    const allTrades = await db.trade.findMany({ select: { id: true, name: true } });
    const tradeMap = new Map<string, string>();
    allTrades.forEach((t) => tradeMap.set(t.name.toLowerCase().trim(), t.id));

    let createdCount = 0;
    let updatedCount = 0;

    await db.$transaction(async (tx) => {
      for (const row of preview.rows) {
        const d = row.data;

        // Check if updating an existing record
        const existingMatch = row.duplicateMatches[0];
        if (updateMatchedRecords && existingMatch) {
          const contractorId = existingMatch.contractorId;

          await tx.contractor.update({
            where: { id: contractorId },
            data: {
              companyName: d.companyName,
              tradingName: d.tradingName || undefined,
              registrationNumber: d.registrationNumber || undefined,
              registrationType: d.registrationType || undefined,
              gstRegistered: d.gstRegistered,
              website: d.website || undefined,
              mainPhone: d.mainPhone || undefined,
              mainEmail: d.mainEmail || undefined,
              addressLine1: d.addressLine1 || undefined,
              addressLine2: d.addressLine2 || undefined,
              suburb: d.suburb || undefined,
              state: d.state || undefined,
              postcode: d.postcode || undefined,
              country: d.country || "AU",
              afterHoursAvailable: d.afterHoursAvailable,
              emergencyPhone: d.emergencyPhone || undefined,
              paymentTerms: d.paymentTerms || undefined,
              callOutFee: d.callOutFee !== undefined ? new Prisma.Decimal(d.callOutFee) : undefined,
              hourlyRate: d.hourlyRate !== undefined ? new Prisma.Decimal(d.hourlyRate) : undefined,
              internalNotes: d.internalNotes || undefined,
              version: { increment: 1 },
            },
          });

          // Link trades
          if (d.trades && d.trades.length > 0) {
            for (const tName of d.trades) {
              const tradeId = tradeMap.get(tName.toLowerCase());
              if (tradeId) {
                await tx.contractorTrade.upsert({
                  where: { contractorId_tradeId: { contractorId, tradeId } },
                  create: { contractorId, tradeId, isPrimary: false },
                  update: {},
                });
              }
            }
          }

          // Add or update primary contact
          if (d.contactName) {
            await tx.contractorContact.create({
              data: {
                contractorId,
                name: d.contactName,
                phone: d.contactPhone || null,
                email: d.contactEmail || null,
                isPrimary: false,
                isActive: true,
              },
            });
          }

          updatedCount++;
        } else {
          // Create new contractor
          const code = await generateContractorCode();

          const contractor = await tx.contractor.create({
            data: {
              code,
              companyName: d.companyName,
              tradingName: d.tradingName || null,
              registrationNumber: d.registrationNumber || null,
              registrationType: d.registrationType || "ABN",
              gstRegistered: d.gstRegistered ?? true,
              status: "ACTIVE",
              isPreferred: false,
              website: d.website || null,
              mainPhone: d.mainPhone || null,
              mainEmail: d.mainEmail || null,
              addressLine1: d.addressLine1 || null,
              addressLine2: d.addressLine2 || null,
              suburb: d.suburb || null,
              state: d.state || null,
              postcode: d.postcode || null,
              country: d.country || "AU",
              serviceAreas: [],
              afterHoursAvailable: d.afterHoursAvailable ?? false,
              emergencyPhone: d.emergencyPhone || null,
              paymentTerms: d.paymentTerms || null,
              callOutFee: d.callOutFee !== undefined ? new Prisma.Decimal(d.callOutFee) : null,
              hourlyRate: d.hourlyRate !== undefined ? new Prisma.Decimal(d.hourlyRate) : null,
              currency: "AUD",
              internalNotes: d.internalNotes || null,
              createdById: userId,
            },
          });

          // Link trades
          if (d.trades && d.trades.length > 0) {
            for (let i = 0; i < d.trades.length; i++) {
              const tradeName = d.trades[i];
              if (!tradeName) continue;
              const tradeId = tradeMap.get(tradeName.toLowerCase());
              if (tradeId) {
                await tx.contractorTrade.create({
                  data: {
                    contractorId: contractor.id,
                    tradeId,
                    isPrimary: i === 0,
                  },
                });
              }
            }
          }

          // Add contact
          if (d.contactName) {
            await tx.contractorContact.create({
              data: {
                contractorId: contractor.id,
                name: d.contactName,
                phone: d.contactPhone || null,
                email: d.contactEmail || null,
                isPrimary: true,
                isActive: true,
              },
            });
          }

          createdCount++;
        }
      }
    });

    await logAudit({
      entityType: "CONTRACTOR_IMPORT",
      entityId: "batch",
      userId,
      action: "IMPORT_CONTRACTORS",
      newValue: {
        createdCount,
        updatedCount,
        totalImported: createdCount + updatedCount,
        updateMatchedRecords,
      },
    });

    return {
      success: true,
      createdCount,
      updatedCount,
      total: createdCount + updatedCount,
    };
  }

  /**
   * Return standard CSV import template.
   */
  public static getTemplateCsv(): string {
    const headers = [
      "companyName",
      "tradingName",
      "registrationType",
      "registrationNumber",
      "gstRegistered",
      "trades",
      "contactName",
      "contactPhone",
      "contactEmail",
      "addressLine1",
      "suburb",
      "state",
      "postcode",
      "country",
      "website",
      "mainPhone",
      "mainEmail",
      "afterHoursAvailable",
      "emergencyPhone",
      "paymentTerms",
      "callOutFee",
      "hourlyRate",
      "internalNotes",
    ];

    const sampleRow = [
      '"Apex Plumbing & Gas"',
      '"Apex Plumbing"',
      "ABN",
      "51824753556",
      "true",
      '"Plumbing,HVAC and AC"',
      '"John Smith"',
      '"0412 345 678"',
      '"john@apexplumbing.com.au"',
      '"12 Industrial Road"',
      '"Springfield"',
      '"VIC"',
      '"3000"',
      '"AU"',
      '"https://apexplumbing.com.au"',
      '"03 9876 5432"',
      '"info@apexplumbing.com.au"',
      "true",
      '"0400 111 222"',
      '"Net 30"',
      "120.00",
      "95.00",
      '"Recommended commercial plumber with rapid response."',
    ];

    return `${headers.join(",")}\r\n${sampleRow.join(",")}\r\n`;
  }
}
