import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  SummaryService,
  ensureLicencesEnabled,
  getLicenceTierContext,
} from "@/modules/licences";

export const runtime = "nodejs";

export const GET = withAuth("licences.directory.view", async (req, { user }) => {
  await ensureLicencesEnabled();

  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const onDate = url.searchParams.get("onDate") ? new Date(url.searchParams.get("onDate")!) : new Date();

  const tierContext = getLicenceTierContext(user);
  const matrix = await SummaryService.getMatrix(categoryId, tierContext, onDate);

  return NextResponse.json(
    { data: matrix },
    { headers: { "Cache-Control": "no-store" } }
  );
});
