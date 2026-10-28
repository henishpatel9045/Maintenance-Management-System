import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { FileBucket, ArtefactType, ArtefactStage, QuoteStatus } from "@prisma/client";

export const runtime = "nodejs";

const patchFileSchema = z
  .object({
    caption: z.string().max(500).optional().nullable(),
    label: z.string().max(100).optional().nullable(),
    supplierName: z.string().max(200).optional().nullable(),
    amount: z.number().optional().nullable(),
    currency: z.string().max(10).optional(),
    validUntil: z.string().or(z.date()).optional().nullable(),
    quoteStatus: z.nativeEnum(QuoteStatus).optional().nullable(),
    notes: z.string().optional().nullable(),
    artefactType: z.nativeEnum(ArtefactType).optional().nullable(),
    stage: z.nativeEnum(ArtefactStage).optional().nullable(),
    bucket: z.nativeEnum(FileBucket).optional(),
  })
  .strict();

export const PATCH = withAuth("artefacts.manage", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(patchFileSchema, req);

  const existing = await db.sevaFile.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw new AppError(404, "FILE_NOT_FOUND", "File record not found");
  }

  const updated = await db.sevaFile.update({
    where: { id },
    data: {
      ...(body.caption !== undefined ? { caption: body.caption } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.supplierName !== undefined ? { supplierName: body.supplierName } : {}),
      ...(body.amount !== undefined ? { amount: body.amount } : {}),
      ...(body.currency ? { currency: body.currency } : {}),
      ...(body.validUntil !== undefined ? { validUntil: body.validUntil ? new Date(body.validUntil) : null } : {}),
      ...(body.quoteStatus !== undefined ? { quoteStatus: body.quoteStatus } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.artefactType !== undefined ? { artefactType: body.artefactType } : {}),
      ...(body.stage !== undefined ? { stage: body.stage } : {}),
      ...(body.bucket ? { bucket: body.bucket } : {}),
    },
    include: { fileObject: true },
  });

  await logAudit({
    entityType: "SEVA_FILE",
    entityId: id,
    userId: user.id,
    action: "UPDATE_FILE_METADATA",
    oldValue: { bucket: existing.bucket, label: existing.label, caption: existing.caption },
    newValue: { bucket: updated.bucket, label: updated.label, caption: updated.caption },
  });

  return NextResponse.json({
    data: {
      ...updated,
      fileObject: {
        ...updated.fileObject,
        sizeBytes: updated.fileObject.sizeBytes.toString(),
      },
    },
  });
});

export const DELETE = withAuth("artefacts.manage", async (_req, { user, params }) => {
  const { id } = params as { id: string };

  const existing = await db.sevaFile.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw new AppError(404, "FILE_NOT_FOUND", "File not found or already deleted");
  }

  // If deleting an approved quote, remove approvedBudget from seva
  if (existing.quoteStatus === QuoteStatus.APPROVED) {
    await db.seva.update({
      where: { id: existing.sevaId },
      data: { approvedBudget: null, version: { increment: 1 } },
    });
  }

  await db.sevaFile.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    entityType: "SEVA_FILE",
    entityId: id,
    userId: user.id,
    action: "DELETE_FILE",
  });

  return NextResponse.json({ success: true, message: "File soft-deleted" });
});
