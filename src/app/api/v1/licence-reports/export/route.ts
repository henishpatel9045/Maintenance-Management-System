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

interface LicenceExportInput {
  format: "csv" | "xlsx" | "pdf";
  reportType:
    | "HOLDERS_BY_TYPE"
    | "EXPIRY"
    | "MATRIX"
    | "GAP"
    | "PERSON_SHEET"
    | "COMPLIANCE_BY_SEVA"
    | "TRENDS";
  licenceTypeId?: string;
  targetUserId?: string;
  withinDays?: number;
}

async function handleLicenceExport(
  body: LicenceExportInput,
  user: any
) {
  const format = body.format || "csv";
  const withinDays = body.withinDays ?? 60;
  let result: { buffer: Buffer; contentType: string; filename: string };
  switch (body.reportType) {
    case "HOLDERS_BY_TYPE":
      result = await LicenceReportsService.exportHoldersByType(format, user, {
        licenceTypeId: body.licenceTypeId,
      });
      break;
    case "EXPIRY":
      result = await LicenceReportsService.exportExpiryReport(format, user, withinDays);
      break;
    case "MATRIX":
      result = await LicenceReportsService.exportMatrixReport(body.format, user);
      break;
    case "GAP":
      result = await LicenceReportsService.exportGapReport(body.format, user);
      break;
    case "PERSON_SHEET":
      result = await LicenceReportsService.exportPersonSheet(
        body.targetUserId || user.id,
        user
      );
      break;
    case "COMPLIANCE_BY_SEVA":
      result = await LicenceReportsService.exportSevaCompliance(body.format, user);
      break;
    case "TRENDS":
    default:
      result = await LicenceReportsService.exportTrendReport(body.format, user, body.licenceTypeId);
      break;
  }

  const headers = new Headers();
  headers.set("Content-Type", result.contentType);
  headers.set("Content-Disposition", `attachment; filename="${result.filename}"`);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers,
  });
}

export const GET = withAuth("licences.reports.view", async (req, { user }) => {
  await ensureLicencesEnabled();

  const url = new URL(req.url);
  const reportType = (url.searchParams.get("reportType") || "HOLDERS_BY_TYPE") as any;
  const format = (url.searchParams.get("format") || "csv") as any;
  const licenceTypeId = url.searchParams.get("licenceTypeId") || undefined;
  const targetUserId = url.searchParams.get("targetUserId") || undefined;
  const withinDays = url.searchParams.get("withinDays")
    ? parseInt(url.searchParams.get("withinDays")!, 10)
    : 60;

  const validated = exportReportSchema.parse({
    reportType,
    format,
    licenceTypeId,
    targetUserId,
    withinDays,
  });

  return handleLicenceExport(validated, user);
});

export const POST = withAuth("licences.reports.view", async (req, { user }) => {
  await ensureLicencesEnabled();

  const body = await validateBody(exportReportSchema, req);
  const url = new URL(req.url);
  const queryFormat = url.searchParams.get("format") as "csv" | "xlsx" | "pdf" | null;
  const format: "csv" | "xlsx" | "pdf" = queryFormat || body.format || "csv";

  return handleLicenceExport({ ...body, format }, user);
});
