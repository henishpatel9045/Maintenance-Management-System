import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { generateSevaCode } from "@/modules/seva/code";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { OccurrenceStatus } from "@prisma/client";

export const runtime = "nodejs";

export const POST = withAuth("seva.create", async (_req, { user, params }) => {
  const { id } = params as { id: string };

  const source = await db.seva.findUnique({
    where: { id },
    include: {
      checklistItems: true,
      tags: true,
    },
  });

  if (!source) {
    throw new AppError(404, "SEVA_NOT_FOUND", "Source seva not found");
  }

  const result = await db.$transaction(async (tx) => {
    const tempId = crypto.randomUUID();
    const code = await generateSevaCode();
    const finalPath = source.parentId
      ? `${source.path.slice(0, source.path.lastIndexOf(source.id))}${tempId}/`
      : `/${tempId}/`;

    const duplicate = await tx.seva.create({
      data: {
        id: tempId,
        code,
        title: `${source.title} (Copy)`,
        description: source.description,
        kind: source.kind,
        subKind: source.subKind,
        categoryId: source.categoryId,
        areaId: source.areaId,
        priority: source.priority,
        parentId: source.parentId,
        isGroup: false, // Duplicates create a fresh leaf
        scheduleMode: source.scheduleMode,
        requiresVerification: source.requiresVerification,
        estimatedBudget: source.estimatedBudget,
        path: finalPath,
        depth: source.depth,
        createdById: user.id,
      },
    });

    // Copy tags
    if (source.tags.length > 0) {
      await tx.sevaTag.createMany({
        data: source.tags.map((t) => ({ sevaId: duplicate.id, tagId: t.tagId })),
      });
    }

    // Copy checklist
    if (source.checklistItems.length > 0) {
      await tx.checklistItem.createMany({
        data: source.checklistItems.map((c) => ({
          sevaId: duplicate.id,
          text: c.text,
          sortOrder: c.sortOrder,
        })),
      });
    }

    // Single occurrence for copied leaf
    const occ = await tx.occurrence.create({
      data: {
        sevaId: duplicate.id,
        dueDate: new Date(),
        status: OccurrenceStatus.PENDING,
      },
    });

    if (source.checklistItems.length > 0) {
      const items = await tx.checklistItem.findMany({ where: { sevaId: duplicate.id } });
      await tx.occurrenceChecklist.createMany({
        data: items.map((it) => ({
          occurrenceId: occ.id,
          checklistItemId: it.id,
          isCompleted: false,
        })),
      });
    }

    await logAudit({
      entityType: "SEVA",
      entityId: duplicate.id,
      userId: user.id,
      action: "DUPLICATE_SEVA",
      newValue: { sourceCode: source.code, newCode: duplicate.code },
    });

    return duplicate;
  });

  return NextResponse.json({ data: result }, { status: 201 });
});
