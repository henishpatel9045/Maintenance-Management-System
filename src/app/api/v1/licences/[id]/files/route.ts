import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import {
  LicenceStorageService,
  ensureLicencesEnabled,
  getLicenceTierContext,
} from "@/modules/licences";

export const runtime = "nodejs";

// GET /api/v1/licences/:id/files - List files
export const GET = withAuth<{ id: string }>({}, async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const tierContext = getLicenceTierContext(user);
  const docs = await LicenceStorageService.getLicenceDocuments(id, tierContext);

  return NextResponse.json(
    { data: docs },
    { headers: { "Cache-Control": "no-store" } }
  );
});

// POST /api/v1/licences/:id/files - Upload file
export const POST = withAuth<{ id: string }>({}, async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const licence = await db.userLicence.findUnique({ where: { id } });
  if (!licence || licence.archivedAt != null) {
    throw new AppError(404, "NOT_FOUND", "Licence not found");
  }

  const tierContext = getLicenceTierContext(user);
  const isOwn = licence.userId === user.id;

  if (!isOwn && !tierContext.canManage) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to upload documents for this licence");
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
    userId: licence.userId,
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
