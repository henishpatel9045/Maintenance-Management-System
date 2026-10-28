import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody, validateQuery } from "@/core/http/validate";
import { db } from "@/core/db";
import { generateSevaCode } from "@/modules/seva/code";
import { generateOccurrencesForSeva } from "@/modules/seva/recurrence";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { SevaKind, SevaSubKind, Priority, ScheduleMode, OccurrenceStatus, RecurrenceFrequency, Prisma } from "@prisma/client";

export const runtime = "nodejs";

const recurrenceInputSchema = z.object({
  frequency: z.nativeEnum(RecurrenceFrequency),
  interval: z.number().int().min(1).default(1),
  byWeekday: z.array(z.number().int().min(1).max(7)).default([]),
  byMonthDay: z.array(z.number().int().min(1).max(31)).default([]),
  bySetPos: z.number().int().optional().nullable(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional().nullable(),
});

const createSevaSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000),
  kind: z.nativeEnum(SevaKind).default(SevaKind.ONE_TIME),
  subKind: z.nativeEnum(SevaSubKind).optional().nullable(),
  categoryId: z.string().uuid(),
  areaId: z.string().uuid(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  parentId: z.string().uuid().optional().nullable(),
  isGroup: z.boolean().default(false),
  startDate: z.string().or(z.date()).optional().nullable(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  scheduleMode: z.nativeEnum(ScheduleMode).default(ScheduleMode.FIXED),
  requiresVerification: z.boolean().default(false),
  estimatedBudget: z.number().optional().nullable(),
  tagIds: z.array(z.string().uuid()).default([]),
  assignees: z.array(
    z.object({
      userId: z.string().uuid(),
      isLead: z.boolean().default(false),
    })
  ).default([]),
  checklist: z.array(z.object({ text: z.string().min(1).max(500) })).default([]),
  recurrence: recurrenceInputSchema.optional().nullable(),
}).strict();

export const GET = withAuth("seva.read", async (req, { user }) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const kind = url.searchParams.get("kind") as SevaKind | null;
  const subKind = url.searchParams.get("subKind") as SevaSubKind | null;
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const areaId = url.searchParams.get("areaId") || undefined;
  const priority = url.searchParams.get("priority") as Priority | null;
  const assigneeId = url.searchParams.get("assigneeId") || undefined;
  const parentId = url.searchParams.get("parentId");
  const rootId = url.searchParams.get("rootId");
  const isGroup = url.searchParams.has("isGroup") ? url.searchParams.get("isGroup") === "true" : undefined;
  const isArchived = url.searchParams.get("isArchived") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25", 10)));

  // Root scoping
  let pathFilter: Prisma.StringFilter | undefined;
  if (rootId) {
    const root = await db.seva.findUnique({ where: { id: rootId }, select: { path: true } });
    if (root) {
      pathFilter = { startsWith: root.path };
    }
  }

  // Capability constraint check for members when membersSeeAllSeva is false
  let memberScopeWhere: Prisma.SevaWhereInput = {};
  if (user.role === "MEMBER") {
    const membersSeeAll = user.settings?.["membersSeeAllSeva"] !== false;
    if (!membersSeeAll) {
      memberScopeWhere = {
        OR: [
          { assignees: { some: { userId: user.id } } },
          { watchers: { some: { userId: user.id } } },
        ],
      };
    }
  }

  const where: Prisma.SevaWhereInput = {
    isArchived,
    ...memberScopeWhere,
    ...(kind ? { kind } : {}),
    ...(subKind ? { subKind } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(areaId ? { areaId } : {}),
    ...(priority ? { priority } : {}),
    ...(isGroup !== undefined ? { isGroup } : {}),
    ...(parentId !== null && parentId !== undefined ? { parentId: parentId === "root" ? null : parentId } : {}),
    ...(pathFilter ? { path: pathFilter } : {}),
    ...(assigneeId ? { assignees: { some: { userId: assigneeId } } } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, sevas] = await Promise.all([
    db.seva.count({ where }),
    db.seva.findMany({
      where,
      include: {
        category: true,
        area: true,
        parent: { select: { id: true, code: true, title: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        tags: { include: { tag: true } },
        _count: {
          select: {
            children: true,
            occurrences: true,
            files: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    data: sevas,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

export const POST = withAuth("seva.create", async (req, { user }) => {
  const body = await validateBody(createSevaSchema, req);

  // Parent validations & path setup
  let pathPrefix = "";
  let depth = 0;

  if (body.parentId) {
    const parent = await db.seva.findUnique({
      where: { id: body.parentId },
      select: { id: true, path: true, depth: true, isGroup: true },
    });
    if (!parent) throw new AppError(404, "PARENT_NOT_FOUND", "Parent seva not found");

    const maxDepth = Number(user.settings?.["maxSevaDepth"] ?? 6);
    if (parent.depth + 1 > maxDepth) {
      throw new AppError(400, "MAX_DEPTH_EXCEEDED", `Max depth ${maxDepth} exceeded`);
    }

    // Auto-mark parent as group if needed
    if (!parent.isGroup) {
      await db.seva.update({ where: { id: parent.id }, data: { isGroup: true } });
    }

    pathPrefix = parent.path;
    depth = parent.depth + 1;
  }

  const result = await db.$transaction(async (tx) => {
    const tempId = crypto.randomUUID();
    const code = await generateSevaCode();
    const finalPath = pathPrefix ? `${pathPrefix}${tempId}/` : `/${tempId}/`;

    const seva = await tx.seva.create({
      data: {
        id: tempId,
        code,
        title: body.title,
        description: body.description,
        kind: body.kind,
        subKind: body.kind === SevaKind.ONE_TIME ? body.subKind : null,
        categoryId: body.categoryId,
        areaId: body.areaId,
        priority: body.priority,
        parentId: body.parentId ?? null,
        isGroup: body.isGroup,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        scheduleMode: body.scheduleMode,
        requiresVerification: body.requiresVerification,
        estimatedBudget: body.estimatedBudget ? body.estimatedBudget : null,
        path: finalPath,
        depth,
        createdById: user.id,
      },
    });

    // Tags
    const tagIds = body.tagIds ?? [];
    if (tagIds.length > 0) {
      await tx.sevaTag.createMany({
        data: tagIds.map((tagId) => ({ sevaId: seva.id, tagId })),
      });
    }

    // Assignees
    const assignees = body.assignees ?? [];
    if (assignees.length > 0) {
      await tx.sevaAssignee.createMany({
        data: assignees.map((a) => ({
          sevaId: seva.id,
          userId: a.userId,
          isLead: a.isLead,
          assignedById: user.id,
        })),
      });

      // Dispatch notifications to assignees
      await tx.notification.createMany({
        data: assignees.map((a) => ({
          userId: a.userId,
          type: "SEVA_ASSIGNED",
          title: `Assigned to Seva: ${seva.title}`,
          body: `You have been assigned to ${seva.code}: ${seva.title}`,
          entityType: "SEVA",
          entityId: seva.id,
          linkUrl: `/seva/${seva.id}`,
        })),
      });
    }

    // Checklist Items
    const checklist = body.checklist ?? [];
    if (checklist.length > 0) {
      await tx.checklistItem.createMany({
        data: checklist.map((item, idx) => ({
          sevaId: seva.id,
          text: item.text,
          sortOrder: idx + 1,
        })),
      });
    }

    // If ONE_TIME leaf seva, create single occurrence
    if (body.kind === SevaKind.ONE_TIME && !body.isGroup) {
      const occurrenceDueDate = body.dueDate ? new Date(body.dueDate) : new Date();
      const occ = await tx.occurrence.create({
        data: {
          sevaId: seva.id,
          dueDate: occurrenceDueDate,
          status: OccurrenceStatus.PENDING,
        },
      });

      // Copy checklist items to occurrence
      const items = await tx.checklistItem.findMany({ where: { sevaId: seva.id } });
      if (items.length > 0) {
        await tx.occurrenceChecklist.createMany({
          data: items.map((it) => ({
            occurrenceId: occ.id,
            checklistItemId: it.id,
            isCompleted: false,
          })),
        });
      }
    }

    // If RECURRING leaf seva, create recurrence rule
    if (body.kind === SevaKind.RECURRING && !body.isGroup && body.recurrence) {
      await tx.recurrenceRule.create({
        data: {
          sevaId: seva.id,
          frequency: body.recurrence.frequency,
          interval: body.recurrence.interval,
          byWeekday: body.recurrence.byWeekday,
          byMonthDay: body.recurrence.byMonthDay,
          bySetPos: body.recurrence.bySetPos ?? null,
          startDate: new Date(body.recurrence.startDate),
          endDate: body.recurrence.endDate ? new Date(body.recurrence.endDate) : null,
        },
      });
    }

    await logAudit({
      entityType: "SEVA",
      entityId: seva.id,
      userId: user.id,
      action: "CREATE_SEVA",
      newValue: { code: seva.code, title: seva.title, kind: seva.kind },
    });

    return seva;
  });

  // If recurring, generate horizon occurrences
  if (body.kind === SevaKind.RECURRING && !body.isGroup) {
    const horizon = Number(user.settings?.["recurrenceHorizonDays"] ?? 90);
    await generateOccurrencesForSeva({ sevaId: result.id, horizonDays: horizon });
  }

  return NextResponse.json({ data: result }, { status: 201 });
});
