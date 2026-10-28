import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { LicenceStorageService, ensureLicencesEnabled } from "@/modules/licences";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("licences.own.submit", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const licence = await db.userLicence.findUnique({
    where: { id },
  });

  if (!licence || licence.userId !== user.id || licence.archivedAt != null) {
    throw new AppError(404, "NOT_FOUND", "Licence not found or access denied");
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) throw new AppError(400, "MISSING_FILE", "File is required");

  const kind = (formData.get("kind") as any) || "FRONT";
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await LicenceStorageService.uploadLicenceDocument({
    buffer,
    originalName: file.name,
    userId: user.id,
    licenceId: id,
    kind,
    uploadedById: user.id,
    settings: user.settings,
  });

  return NextResponse.json(
    { data: result.fileLink },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
});
