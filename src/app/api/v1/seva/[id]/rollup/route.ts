import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { computeRollup } from "@/modules/seva/hierarchy";

export const runtime = "nodejs";

export const GET = withAuth("seva.read", async (_req, { params }) => {
  const { id } = params as { id: string };
  const rollup = await computeRollup(id);
  return NextResponse.json({ data: rollup });
});
