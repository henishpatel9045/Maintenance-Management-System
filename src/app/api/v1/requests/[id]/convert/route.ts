import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { generateSevaCode } from "@/modules/seva/code";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { RequestStatus, SevaKind, Priority, ScheduleMode, OccurrenceStatus } from "@prisma/client";

export const runtime = "nodejs";

const convertSchema = z
  .object({
    priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
    dueDate: z.string().or(z.date()).optional().nullable(),
    assigneeIds: z.array(z.string().uuid()).default([]),
    adminNote: z.string().optional().nullable(),
  })
  .strict();

export const POST = withAuth("requests.manage", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(convertSchema, req);

  const request = await db.sevaRequest.findUnique({ where: { id } });
  if (!request) {
    throw new AppError(404, "REQUEST_NOT_FOUND", "Seva request not found");
  }

  if (request.status !== RequestStatus.OPEN) {
    throw new AppError(400, "REQUEST_NOT_OPEN", `Request is already ${request.status}`);
  }

  const result = await db.$transaction(async (tx) => {
    const tempId = crypto.randomUUID();
    const code = await generateSevaCode();
    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date();

    // 1. Create Seva
    const seva = await tx.seva.create({
      data: {
        id: tempId,
        code,
        title: request.title,
        description: request.description,
        kind: SevaKind.ONE_TIME,
        categoryId: request.categoryId,
        areaId: request.areaId,
        priority: body.priority,
        dueDate,
        scheduleMode: ScheduleMode.FIXED,
        path: `/${tempId}/`,
        depth: 0,
        createdById: user.id,
      },
    });

    // 2. Create Occurrence
    await tx.occurrence.create({
      data: {
        sevaId: seva.id,
        dueDate,
        status: OccurrenceStatus.PENDING,
      },
    });

    // 3. Assignees
    const assigneeIds = body.assigneeIds ?? [];
    if (assigneeIds.length > 0) {
      await tx.sevaAssignee.createMany({
        data: assigneeIds.map((userId, idx) => ({
          sevaId: seva.id,
          userId,
          isLead: idx === 0,
          assignedById: user.id,
        })),
      });
    }

    // 4. Update request status
    await tx.sevaRequest.update({
      where: { id },
      data: {
        status: RequestStatus.CONVERTED,
        convertedSevaId: seva.id,
        adminNote: body.adminNote ?? null,
      },
    });

    // 5. Notify submitter
    await tx.notification.create({
      data: {
        userId: request.requestedById,
        type: "REQUEST_CONVERTED",
        title: "Your Seva Request was Approved",
        body: `Converted to Seva ${seva.code}: ${seva.title}`,
        entityType: "SEVA",
        entityId: seva.id,
        linkUrl: `/seva/${seva.id}`,
      },
    });

    await logAudit({
      entityType: "SEVA_REQUEST",
      entityId: id,
      userId: user.id,
      action: "CONVERT_REQUEST",
      newValue: { sevaId: seva.id, code: seva.code },
    });

    return seva;
  });

  return NextResponse.json({ data: result }, { status: 201 });
});
