import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { ImportService, ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth("contractors.import", async () => {
  await ensureContractorsEnabled();

  const csv = ImportService.getTemplateCsv();

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contractors-import-template.csv"',
    },
  });
});
