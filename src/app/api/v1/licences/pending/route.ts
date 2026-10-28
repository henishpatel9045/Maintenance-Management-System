import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  LicenceService,
  ensureLicencesEnabled,
} from "@/modules/licences";

export const runtime = "nodejs";

// GET /api/v1/licences/pending - licences.verify
export const GET = withAuth("licences.verify", async () => {
  await ensureLicencesEnabled();

  const queue = await LicenceService.getPendingVerificationQueue();

  return NextResponse.json(
    { data: queue },
    { headers: { "Cache-Control": "no-store" } }
  );
});
