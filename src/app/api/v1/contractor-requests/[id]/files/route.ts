import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import {
  ContractorStorageService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("contractors.request", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const request = await db.contractorRequest.findUnique({
    where: { id: params.id },
  });

  if (!request) throw new AppError(404, "NOT_FOUND", "Request not found");
  if (request.requestedById !== user.id) {
    throw new AppError(403, "FORBIDDEN", "You can only attach files to your own requests");
  }
  if (request.status !== "OPEN") {
    throw new AppError(400, "BAD_REQUEST", "Files can only be added to OPEN requests");
  }

  // Check file count quota (up to 3 files per request)
  const currentCount = await db.fileLink.count({
    where: { entityType: "CONTRACTOR_REQUEST", entityId: params.id },
  });
  if (currentCount >= 3) {
    throw new AppError(400, "MAX_FILES_EXCEEDED", "Maximum 3 supporting files allowed per request");
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) throw new AppError(400, "MISSING_FILE", "File is required");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await ContractorStorageService.uploadRequestDocument({
    buffer,
    originalName: file.name,
    requestCode: request.code,
    uploadedById: user.id,
  });

  return NextResponse.json({ data: result }, { status: 201 });
});
