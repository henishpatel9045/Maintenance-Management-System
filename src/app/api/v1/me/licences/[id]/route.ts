import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { LicenceService, ensureLicencesEnabled } from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

// DELETE /api/v1/me/licences/:id - Withdraw pending submission
export const DELETE = withAuth<{ id: string }>("licences.own.submit", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const withdrawn = await LicenceService.withdrawSubmission(user.id, id);

  return NextResponse.json(
    { data: withdrawn, message: "Licence submission withdrawn" },
    { headers: { "Cache-Control": "no-store" } }
  );
});
