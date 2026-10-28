import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  LicenceReportsService,
  ensureLicencesEnabled,
} from "@/modules/licences";
import { z } from "zod";

export const runtime = "nodejs";

const previewReportSchema = z.object({
  reportType: z.enum([
    "HOLDERS_BY_TYPE",
    "EXPIRY",
    "MATRIX",
    "GAP",
    "COMPLIANCE_BY_SEVA",
    "TRENDS",
  ]),
  licenceTypeId: z.string().uuid().optional(),
  withinDays: z.number().int().positive().optional().default(60),
});

export const POST = withAuth("licences.reports.view", async (req, { user }) => {
  await ensureLicencesEnabled();

  const body = await validateBody(previewReportSchema, req);

  // For preview, we export as CSV and parse back the data
  let exportResult;
  switch (body.reportType) {
    case "HOLDERS_BY_TYPE":
      exportResult = await LicenceReportsService.exportHoldersByType("csv", user, {
        licenceTypeId: body.licenceTypeId,
      });
      break;
    case "EXPIRY":
      exportResult = await LicenceReportsService.exportExpiryReport("csv", user, body.withinDays);
      break;
    case "MATRIX":
      exportResult = await LicenceReportsService.exportMatrixReport("csv", user);
      break;
    case "GAP":
      exportResult = await LicenceReportsService.exportGapReport("csv", user);
      break;
    case "COMPLIANCE_BY_SEVA":
      exportResult = await LicenceReportsService.exportSevaCompliance("csv", user);
      break;
    case "TRENDS":
      exportResult = await LicenceReportsService.exportTrendReport("csv", user, body.licenceTypeId);
      break;
  }

  const csvText = exportResult.buffer.toString("utf-8");

  return NextResponse.json(
    { data: { reportType: body.reportType, csv: csvText } },
    { headers: { "Cache-Control": "no-store" } }
  );
});
