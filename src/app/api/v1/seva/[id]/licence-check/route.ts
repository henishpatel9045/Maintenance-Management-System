import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  SevaLicenceService,
  ensureLicencesEnabled,
} from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

// GET /api/v1/seva/:id/licence-check
export const GET = withAuth<{ id: string }>("seva.read", async (req, { params }) => {
  await ensureLicencesEnabled();
  const sevaId = params.id;
  if (!sevaId) throw new AppError(400, "INVALID_ID", "Seva ID is required");

  const url = new URL(req.url);
  const targetDateParam = url.searchParams.get("targetDate");
  const targetDate = targetDateParam ? new Date(targetDateParam) : undefined;

  const check = await SevaLicenceService.checkSevaLicenceCompliance(sevaId, targetDate);

  return NextResponse.json(
    { data: check },
    { headers: { "Cache-Control": "no-store" } }
  );
});
