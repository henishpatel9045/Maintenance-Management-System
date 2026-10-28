import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { ContractorService, ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("contractors.write", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const archived = await ContractorService.archive(params.id, user.id);
  return NextResponse.json({ success: true, data: archived });
});
