import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { LicenceTypeService, ensureLicencesEnabled, licenceTypeSchema } from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>({}, async (req, { params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "ID is required");

  const type = await LicenceTypeService.getType(id);
  if (!type) throw new AppError(404, "NOT_FOUND", "Licence type not found");

  return NextResponse.json(
    { data: type },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PATCH = withAuth<{ id: string }>("licences.types.manage", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "ID is required");

  const body = await validateBody(licenceTypeSchema.partial(), req);
  const updated = await LicenceTypeService.updateType(id, body, user.id);

  return NextResponse.json(
    { data: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
});
