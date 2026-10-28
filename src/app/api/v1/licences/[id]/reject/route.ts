import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { LicenceService, ensureLicencesEnabled, rejectLicenceSchema } from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("licences.verify", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const body = await validateBody(rejectLicenceSchema, req);
  const rejected = await LicenceService.rejectLicence(user.id, id, body);

  return NextResponse.json(
    { data: rejected, message: "Licence submission rejected" },
    { headers: { "Cache-Control": "no-store" } }
  );
});
