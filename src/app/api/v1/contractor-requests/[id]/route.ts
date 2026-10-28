import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { RequestService, ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>({}, async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const data = await RequestService.getByIdWithDiff(params.id, user);

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
});
