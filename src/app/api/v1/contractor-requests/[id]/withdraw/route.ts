import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { RequestService, ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("contractors.request", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const withdrawn = await RequestService.withdraw(params.id, user.id);
  return NextResponse.json({ success: true, data: withdrawn });
});
