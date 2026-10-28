import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  SummaryService,
  ensureLicencesEnabled,
} from "@/modules/licences";

export const runtime = "nodejs";

export const GET = withAuth("licences.directory.view", async (req) => {
  await ensureLicencesEnabled();

  const url = new URL(req.url);
  const typeId = url.searchParams.get("typeId") || undefined;
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const trends = await SummaryService.getTrends(typeId, from, to);

  return NextResponse.json(
    { data: trends },
    { headers: { "Cache-Control": "no-store" } }
  );
});
