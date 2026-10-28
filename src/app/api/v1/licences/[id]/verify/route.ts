import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { LicenceService, ensureLicencesEnabled, verifyLicenceSchema } from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("licences.verify", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const body = await validateBody(verifyLicenceSchema, req);
  const verified = await LicenceService.verifyLicence(user.id, id, body);

  return NextResponse.json(
    { data: verified, message: "Licence successfully verified" },
    { headers: { "Cache-Control": "no-store" } }
  );
});
