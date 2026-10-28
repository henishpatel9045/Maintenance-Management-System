import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { processFileUpload } from "@/core/storage/pipeline";
import { can } from "@/core/permissions/can";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { FileBucket, ArtefactType, ArtefactStage, QuoteStatus } from "@prisma/client";

export const runtime = "nodejs";

export const GET = withAuth("seva.read", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const url = new URL(req.url);
  const bucketParam = url.searchParams.get("bucket")?.toUpperCase();
  const includeDescendants = url.searchParams.get("includeDescendants") === "true";

  const seva = await db.seva.findUnique({ where: { id }, select: { id: true, path: true } });
  if (!seva) throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");

  let sevaIds = [id];
  if (includeDescendants) {
    const subtree = await db.seva.findMany({
      where: { path: { startsWith: seva.path }, isArchived: false },
      select: { id: true },
    });
    sevaIds = subtree.map((s) => s.id);
  }

  // Filter bucket
  const bucket = bucketParam === "QUOTE" ? FileBucket.QUOTE : bucketParam === "ARTEFACT" ? FileBucket.ARTEFACT : undefined;

  // Permission check for Quotes
  if (bucket === FileBucket.QUOTE && !can(user, "quotes.view")) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to view quotes");
  }

  const files = await db.sevaFile.findMany({
    where: {
      sevaId: { in: sevaIds },
      deletedAt: null,
      ...(bucket ? { bucket } : {}),
      // Hide quotes if user lacks quotes.view
      ...(!can(user, "quotes.view") ? { bucket: FileBucket.ARTEFACT } : {}),
    },
    include: {
      fileObject: true,
      seva: { select: { id: true, code: true, title: true } },
      approvedBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      occurrence: { select: { id: true, dueDate: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: files.map((f) => ({
      ...f,
      fileObject: {
        ...f.fileObject,
        sizeBytes: f.fileObject.sizeBytes.toString(), // BigInt to string for JSON serialization
      },
    })),
  });
});

export const POST = withAuth(
  {
    getContext: async (_req, params) => {
      const { id } = params as { id: string };
      const s = await db.seva.findUnique({
        where: { id },
        include: { assignees: true },
      });
      return {
        seva: {
          id: s?.id || "",
          assigneeIds: s?.assignees.map((a) => a.userId) || [],
        },
      };
    },
  },
  async (req, { user, params }) => {
    const { id: sevaId } = params as { id: string };

    const seva = await db.seva.findUnique({
      where: { id: sevaId },
      include: { assignees: true },
    });
    if (!seva) throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");

    const formData = await req.formData();
    const bucketStr = (formData.get("bucket") as string)?.toUpperCase() || "ARTEFACT";
    const bucket = bucketStr === "QUOTE" ? FileBucket.QUOTE : FileBucket.ARTEFACT;

    // Check capability
    if (bucket === FileBucket.QUOTE && !can(user, "quotes.upload")) {
      throw new AppError(403, "FORBIDDEN", "You lack permission to upload quotes");
    }
    if (bucket === FileBucket.ARTEFACT) {
      const isAssignee = seva.assignees.some((a) => a.userId === user.id);
      if (!can(user, "artefacts.upload", { seva: { id: seva.id, assigneeIds: seva.assignees.map((a) => a.userId) }, isAssignee })) {
        throw new AppError(403, "FORBIDDEN", "You lack permission to upload artefacts on this seva");
      }
    }

    const files = formData.getAll("files") as File[];
    if (!files || files.length === 0) {
      throw new AppError(400, "NO_FILES", "No files uploaded");
    }

    // Optional metadata
    const occurrenceId = (formData.get("occurrenceId") as string) || null;
    const label = (formData.get("label") as string) || null;
    const supplierName = (formData.get("supplierName") as string) || null;
    const amountStr = formData.get("amount") as string;
    const amount = amountStr ? parseFloat(amountStr) : null;
    const notes = (formData.get("notes") as string) || null;
    const validUntilStr = formData.get("validUntil") as string;
    const validUntil = validUntilStr ? new Date(validUntilStr) : null;
    const caption = (formData.get("caption") as string) || null;
    const stage = (formData.get("stage") as ArtefactStage) || ArtefactStage.GENERAL;
    const artefactType = (formData.get("artefactType") as ArtefactType) || ArtefactType.PHOTO;

    const results = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { fileObject, isDuplicate } = await processFileUpload({
        buffer,
        originalName: file.name,
        bucket,
        sevaCode: seva.code,
        uploadedById: user.id,
        settings: user.settings,
      });

      const sevaFile = await db.sevaFile.create({
        data: {
          sevaId,
          occurrenceId,
          fileObjectId: fileObject.id,
          bucket,
          artefactType: bucket === FileBucket.ARTEFACT ? artefactType : null,
          stage: bucket === FileBucket.ARTEFACT ? stage : null,
          caption,
          label,
          supplierName,
          amount,
          validUntil,
          quoteStatus: bucket === FileBucket.QUOTE ? QuoteStatus.RECEIVED : null,
          notes,
          createdById: user.id,
        },
        include: { fileObject: true },
      });

      await logAudit({
        entityType: "SEVA_FILE",
        entityId: sevaFile.id,
        userId: user.id,
        action: bucket === FileBucket.QUOTE ? "UPLOAD_QUOTE" : "UPLOAD_ARTEFACT",
        newValue: { originalName: file.name, bucket, isDuplicate },
      });

      results.push({
        ...sevaFile,
        isDuplicateWarning: isDuplicate,
        fileObject: {
          ...sevaFile.fileObject,
          sizeBytes: sevaFile.fileObject.sizeBytes.toString(),
        },
      });
    }

    return NextResponse.json({ data: results }, { status: 201 });
  }
);
