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
  const onDate = url.searchParams.get("onDate") ? new Date(url.searchParams.get("onDate")!) : new Date();
  const includePending = url.searchParams.get("includePending") === "true";

  const summary = await SummaryService.getSummary(onDate, includePending);

  return NextResponse.json(
    { data: summary },
    { headers: { "Cache-Control": "no-store" } }
  );
});
