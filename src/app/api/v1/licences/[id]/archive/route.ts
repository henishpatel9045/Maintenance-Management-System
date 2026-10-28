import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { LicenceService, ensureLicencesEnabled } from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("licences.manage", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const updated = await LicenceService.archiveLicence(user.id, id);

  return NextResponse.json(
    { data: updated, message: "Licence archived" },
    { headers: { "Cache-Control": "no-store" } }
  );
});
