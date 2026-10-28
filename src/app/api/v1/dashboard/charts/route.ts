import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { computeKpis } from "@/modules/dashboard/kpi";

export const runtime = "nodejs";

export const GET = withAuth("seva.read", async (req) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const rootSevaId = url.searchParams.get("rootSevaId") || undefined;
  const includeDescendants = url.searchParams.get("includeDescendants") !== "false";
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const areaId = url.searchParams.get("areaId") || undefined;

  const { charts } = await computeKpis({
    from,
    to,
    rootSevaId,
    includeDescendants,
    categoryId,
    areaId,
  });

  return NextResponse.json({ data: charts });
});
