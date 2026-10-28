import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  ContractorReportsService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth("contractors.requests.review", async (req, { user }) => {
  await ensureContractorsEnabled();

  const url = new URL(req.url);
  const formatParam = url.searchParams.get("format");
  const format = formatParam === "xlsx" || formatParam === "pdf" ? formatParam : "csv";

  const { buffer, contentType, filename } = await ContractorReportsService.exportRequestsReport(
    format,
    user
  );

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
