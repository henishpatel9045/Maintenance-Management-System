import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const assigneesSchema = z
  .object({
    assignees: z.array(
      z.object({
        userId: z.string().uuid(),
        isLead: z.boolean().default(false),
      })
    ),
  })
  .strict();

export const PUT = withAuth("seva.assign", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(assigneesSchema, req);

  const seva = await db.seva.findUnique({ where: { id } });
  if (!seva) throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");

  await db.$transaction(async (tx) => {
    // 1. Delete existing assignees
    await tx.sevaAssignee.deleteMany({ where: { sevaId: id } });

    // 2. Insert new assignees
    if (body.assignees.length > 0) {
      await tx.sevaAssignee.createMany({
        data: body.assignees.map((a) => ({
          sevaId: id,
          userId: a.userId,
          isLead: a.isLead,
          assignedById: user.id,
        })),
      });

      // Notify new assignees
      await tx.notification.createMany({
        data: body.assignees.map((a) => ({
          userId: a.userId,
          type: "SEVA_ASSIGNED",
          title: `Assignment updated: ${seva.title}`,
          body: `You are assigned to ${seva.code}: ${seva.title}`,
          entityType: "SEVA",
          entityId: seva.id,
          linkUrl: `/seva/${seva.id}`,
        })),
      });
    }

    await logAudit({
      entityType: "SEVA",
      entityId: id,
      userId: user.id,
      action: "UPDATE_ASSIGNEES",
      newValue: body.assignees,
    });
  });

  return NextResponse.json({ success: true, message: "Assignees updated successfully" });
});
