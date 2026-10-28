import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const checklistSchema = z
  .object({
    isCompleted: z.boolean(),
  })
  .strict();

export const PATCH = withAuth(
  {
    permission: "occurrence.updateStatus",
    getContext: async (_req, params) => {
      const { id } = params as { id: string };
      const occ = await db.occurrence.findUnique({
        where: { id },
        include: { seva: { include: { assignees: true } } },
      });
      return {
        seva: {
          id: occ?.sevaId || "",
          assigneeIds: occ?.seva.assignees.map((a) => a.userId) || [],
        },
      };
    },
  },
  async (req, { user, params }) => {
    const { id: occurrenceId, itemId: checklistItemId } = params as {
      id: string;
      itemId: string;
    };
    const body = await validateBody(checklistSchema, req);

    const checklistRecord = await db.occurrenceChecklist.findUnique({
      where: {
        occurrenceId_checklistItemId: {
          occurrenceId,
          checklistItemId,
        },
      },
    });

    if (!checklistRecord) {
      throw new AppError(404, "CHECKLIST_NOT_FOUND", "Checklist item for this occurrence not found");
    }

    const updated = await db.occurrenceChecklist.update({
      where: {
        occurrenceId_checklistItemId: {
          occurrenceId,
          checklistItemId,
        },
      },
      data: {
        isCompleted: body.isCompleted,
        completedAt: body.isCompleted ? new Date() : null,
        completedById: body.isCompleted ? user.id : null,
      },
    });

    await logAudit({
      entityType: "OCCURRENCE_CHECKLIST",
      entityId: checklistRecord.id,
      occurrenceId,
      userId: user.id,
      action: "TOGGLE_CHECKLIST",
      newValue: { isCompleted: body.isCompleted },
    });

    return NextResponse.json({ data: updated });
  }
);
