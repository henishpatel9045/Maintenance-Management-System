import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  ContractorReportsService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth("contractors.readFull", async (req, { user }) => {
  await ensureContractorsEnabled();

  const url = new URL(req.url);
  const formatParam = url.searchParams.get("format");
  const format = formatParam === "xlsx" || formatParam === "pdf" ? formatParam : "csv";

  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const contractorId = url.searchParams.get("contractorId") || undefined;
  const tradeId = url.searchParams.get("tradeId") || undefined;
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const projectSubtreeSevaId = url.searchParams.get("projectSubtreeSevaId") || undefined;

  const { buffer, contentType, filename } = await ContractorReportsService.exportSpendReport(
    format,
    user,
    { from, to, contractorId, tradeId, categoryId, projectSubtreeSevaId }
  );

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
