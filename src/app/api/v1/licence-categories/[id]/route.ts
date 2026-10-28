import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { LicenceTypeService, ensureLicencesEnabled, licenceCategorySchema } from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const PATCH = withAuth<{ id: string }>("licences.types.manage", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "ID is required");

  const body = await validateBody(licenceCategorySchema.partial(), req);
  const updated = await LicenceTypeService.updateCategory(id, body, user.id);

  return NextResponse.json(
    { data: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
});
