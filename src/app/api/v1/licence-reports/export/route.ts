import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  LicenceReportsService,
  ensureLicencesEnabled,
} from "@/modules/licences";
import { z } from "zod";

export const runtime = "nodejs";

const exportReportSchema = z.object({
  reportType: z.enum([
    "HOLDERS_BY_TYPE",
    "EXPIRY",
    "MATRIX",
    "GAP",
    "PERSON_SHEET",
    "COMPLIANCE_BY_SEVA",
    "TRENDS",
  ]),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
  licenceTypeId: z.string().uuid().optional(),
  targetUserId: z.string().uuid().optional(),
  withinDays: z.number().int().positive().optional().default(60),
});

export const POST = withAuth("licences.reports.view", async (req, { user }) => {
  await ensureLicencesEnabled();

  const body = await validateBody(exportReportSchema, req);
  const url = new URL(req.url);
  const queryFormat = url.searchParams.get("format") as "csv" | "xlsx" | "pdf" | null;
  const format: "csv" | "xlsx" | "pdf" = queryFormat || body.format || "csv";

  let result: { buffer: Buffer; contentType: string; filename: string };
  switch (body.reportType) {
    case "HOLDERS_BY_TYPE":
      result = await LicenceReportsService.exportHoldersByType(format, user, {
        licenceTypeId: body.licenceTypeId,
      });
      break;
    case "EXPIRY":
      result = await LicenceReportsService.exportExpiryReport(format, user, body.withinDays);
      break;
    case "MATRIX":
      result = await LicenceReportsService.exportMatrixReport(format, user);
      break;
    case "GAP":
      result = await LicenceReportsService.exportGapReport(format, user);
      break;
    case "PERSON_SHEET":
      result = await LicenceReportsService.exportPersonSheet(
        body.targetUserId || user.id,
        user
      );
      break;
    case "COMPLIANCE_BY_SEVA":
      result = await LicenceReportsService.exportSevaCompliance(format, user);
      break;
    case "TRENDS":
    default:
      result = await LicenceReportsService.exportTrendReport(format, user, body.licenceTypeId);
      break;
  }

  const headers = new Headers();
  headers.set("Content-Type", result.contentType);
  headers.set("Content-Disposition", `attachment; filename="${result.filename}"`);
  headers.set("Cache-Control", "no-store");

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers,
  });
});
