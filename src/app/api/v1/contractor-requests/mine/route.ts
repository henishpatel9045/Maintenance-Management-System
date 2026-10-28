import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { RequestService, ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth("contractors.request", async (req, { user }) => {
  await ensureContractorsEnabled();

  const requests = await RequestService.listMine(user.id);
  return NextResponse.json({ data: requests }, { headers: { "Cache-Control": "no-store" } });
});
