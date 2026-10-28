import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import {
  LicenceService,
  ensureLicencesEnabled,
  getLicenceTierContext,
} from "@/modules/licences";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("licences.sensitive.view", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const licence = await db.userLicence.findUnique({
    where: { id },
    include: { licenceType: true },
  });

  if (!licence || licence.archivedAt != null) {
    throw new AppError(404, "NOT_FOUND", "Licence not found");
  }

  const tierContext = getLicenceTierContext(user);
  const isOwn = licence.userId === user.id;

  // Highly sensitive check: requires BOTH sensitive.view and documents.view
  if (licence.licenceType.isHighlySensitive && !isOwn) {
    if (!tierContext.canDocumentsView) {
      throw new AppError(403, "FORBIDDEN", "Viewing highly sensitive licence numbers requires documents permission");
    }
  }

  const revealed = await LicenceService.revealLicenceNumber(user.id, id);

  return NextResponse.json(
    { data: revealed },
    { headers: { "Cache-Control": "no-store" } }
  );
});
