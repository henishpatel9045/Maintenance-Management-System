import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  SevaLicenceService,
  ensureLicencesEnabled,
  sevaRequiredLicencesSchema,
} from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

// GET /api/v1/seva/:id/required-licences
export const GET = withAuth<{ id: string }>("seva.read", async (req, { params }) => {
  await ensureLicencesEnabled();
  const sevaId = params.id;
  if (!sevaId) throw new AppError(400, "INVALID_ID", "Seva ID is required");

  const requirements = await SevaLicenceService.getSevaRequiredLicences(sevaId);

  return NextResponse.json(
    { data: requirements },
    { headers: { "Cache-Control": "no-store" } }
  );
});

// PUT /api/v1/seva/:id/required-licences - licences.seva.require
export const PUT = withAuth<{ id: string }>("licences.seva.require", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const sevaId = params.id;
  if (!sevaId) throw new AppError(400, "INVALID_ID", "Seva ID is required");

  const body = await validateBody(sevaRequiredLicencesSchema, req);
  const updated = await SevaLicenceService.setSevaRequiredLicences(sevaId, body.requirements, user.id);

  return NextResponse.json(
    { data: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
});
