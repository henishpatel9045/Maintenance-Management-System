import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { LicenceService, ensureLicencesEnabled, renewLicenceSchema } from "@/modules/licences";
import { AppError } from "@/core/http/error";

import { can } from "@/core/permissions/can";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>({}, async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const isCoordinatorOrAdmin = user.role === "ADMIN" || user.role === "COORDINATOR";
  if (!isCoordinatorOrAdmin && !can(user, "licences.manage")) {
    throw new AppError(403, "FORBIDDEN", "Forbidden");
  }

  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const body = await validateBody(renewLicenceSchema, req);
  const renewed = await LicenceService.renewLicence(user.id, id, body, false);

  return NextResponse.json(
    { data: renewed },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
});
