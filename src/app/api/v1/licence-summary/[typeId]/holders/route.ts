import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  SummaryService,
  ensureLicencesEnabled,
  getLicenceTierContext,
} from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const GET = withAuth<{ typeId: string }>("licences.directory.view", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const typeId = params.typeId;
  if (!typeId) throw new AppError(400, "INVALID_ID", "Licence type ID is required");

  const url = new URL(req.url);
  const onDate = url.searchParams.get("onDate") ? new Date(url.searchParams.get("onDate")!) : new Date();
  const includePending = url.searchParams.get("includePending") === "true";

  const tierContext = getLicenceTierContext(user);
  const holders = await SummaryService.getHoldersForType(typeId, tierContext, onDate, includePending);

  return NextResponse.json(
    { data: holders },
    { headers: { "Cache-Control": "no-store" } }
  );
});
