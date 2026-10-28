import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  ContractorReportsService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.read", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const buffer = await ContractorReportsService.generateProfileSheet(params.id, user);

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contractor-profile-${params.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
