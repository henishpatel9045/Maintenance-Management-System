import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { Priority, ScheduleMode } from "@prisma/client";

export const runtime = "nodejs";

const updateSevaSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  priority: z.nativeEnum(Priority).optional(),
  startDate: z.string().or(z.date()).optional().nullable(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  scheduleMode: z.nativeEnum(ScheduleMode).optional(),
  requiresVerification: z.boolean().optional(),
  estimatedBudget: z.number().optional().nullable(),
  expectedVersion: z.number().int(),
  assignees: z
    .array(
      z.object({
        userId: z.string().uuid(),
        isLead: z.boolean().default(false),
      })
    )
    .optional(),
  checklist: z.array(z.object({ text: z.string().min(1).max(500) })).optional(),
}).passthrough();

export const GET = withAuth("seva.read", async (_req, { params, user }) => {
  const { id } = params as { id: string };

  const seva = await db.seva.findUnique({
    where: { id },
    include: {
      category: true,
      area: true,
      parent: { select: { id: true, code: true, title: true } },
      children: {
        select: {
          id: true,
          code: true,
          title: true,
          isGroup: true,
          priority: true,
          sortOrder: true,
          isArchived: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      assignees: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      watchers: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      tags: { include: { tag: true } },
      checklistItems: { orderBy: { sortOrder: "asc" } },
      recurrenceRule: true,
      occurrences: {
        include: {
          completedBy: { select: { id: true, name: true } },
          checklists: { include: { checklistItem: true } },
          _count: { select: { files: true } },
        },
        orderBy: { dueDate: "asc" },
      },
      _count: {
        select: { files: true },
      },
    },
  });

  if (!seva) {
    throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");
  }

  // Capability check for member if membersSeeAllSeva is false
  if (user.role === "MEMBER" && user.settings?.["membersSeeAllSeva"] === false) {
    const isAssignee = seva.assignees.some((a) => a.userId === user.id);
    const isWatcher = seva.watchers.some((w) => w.userId === user.id);
    if (!isAssignee && !isWatcher) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to view this seva");
    }
  }

  // Construct ancestor breadcrumbs from path
  const ancestorIds = seva.path
    .split("/")
    .filter((seg) => seg && seg !== seva.id);

  let ancestors: Array<{ id: string; code: string; title: string }> = [];
  if (ancestorIds.length > 0) {
    ancestors = await db.seva.findMany({
      where: { id: { in: ancestorIds } },
      select: { id: true, code: true, title: true },
    });
  }

  return NextResponse.json({
    data: {
      ...seva,
      ancestors,
    },
  });
});

export const PATCH = withAuth("seva.update", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(updateSevaSchema, req);

  const existing = await db.seva.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");
  }

  // Optimistic locking check
  if (existing.version !== body.expectedVersion) {
    throw new AppError(409, "VERSION_CONFLICT", "Seva was modified by another user. Please refresh and try again.");
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.seva.update({
      where: { id },
      data: {
        ...(body.title ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.categoryId ? { categoryId: body.categoryId } : {}),
        ...(body.areaId ? { areaId: body.areaId } : {}),
        ...(body.priority ? { priority: body.priority } : {}),
        ...(body.startDate !== undefined ? { startDate: body.startDate ? new Date(body.startDate) : null } : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
        ...(body.scheduleMode ? { scheduleMode: body.scheduleMode } : {}),
        ...(body.requiresVerification !== undefined ? { requiresVerification: body.requiresVerification } : {}),
        ...(body.estimatedBudget !== undefined ? { estimatedBudget: body.estimatedBudget } : {}),
        version: { increment: 1 },
      },
    });

    if (body.assignees !== undefined) {
      await tx.sevaAssignee.deleteMany({ where: { sevaId: id } });
      if (body.assignees.length > 0) {
        await tx.sevaAssignee.createMany({
          data: body.assignees.map((a) => ({
            sevaId: id,
            userId: a.userId,
            isLead: a.isLead,
            assignedById: user.id,
          })),
        });
      }
    }

    if (body.checklist !== undefined) {
      await tx.checklistItem.deleteMany({ where: { sevaId: id } });
      if (body.checklist.length > 0) {
        await tx.checklistItem.createMany({
          data: body.checklist.map((item, idx) => ({
            sevaId: id,
            text: item.text,
            sortOrder: idx,
          })),
        });
      }
    }

    return res;
  });

  await logAudit({
    entityType: "SEVA",
    entityId: id,
    userId: user.id,
    action: "UPDATE_SEVA",
    oldValue: { title: existing.title, priority: existing.priority, dueDate: existing.dueDate },
    newValue: { title: updated.title, priority: updated.priority, dueDate: updated.dueDate },
  });

  return NextResponse.json({ data: updated });
});
