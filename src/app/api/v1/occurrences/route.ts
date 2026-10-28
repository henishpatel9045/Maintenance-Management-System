import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { OccurrenceStatus, Prisma } from "@prisma/client";
import { startOfDay, endOfDay, isBefore } from "date-fns";

export const runtime = "nodejs";

export const GET = withAuth("seva.read", async (req, { user }) => {
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "true";
  const isOverdue = url.searchParams.get("isOverdue") === "true";
  const status = url.searchParams.get("status") as OccurrenceStatus | null;
  const sevaId = url.searchParams.get("sevaId") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25", 10)));

  const now = new Date();
  const todayStart = startOfDay(now);

  const where: Prisma.OccurrenceWhereInput = {
    seva: {
      isArchived: false,
      ...(sevaId ? { id: sevaId } : {}),
      ...(mine ? { assignees: { some: { userId: user.id } } } : {}),
    },
    ...(status ? { status } : {}),
  };

  if (isOverdue) {
    where.dueDate = { lt: todayStart };
    where.status = { notIn: [OccurrenceStatus.DONE, OccurrenceStatus.SKIPPED, OccurrenceStatus.CANCELLED] };
  } else if (from || to) {
    where.dueDate = {};
    if (from) where.dueDate.gte = startOfDay(new Date(from));
    if (to) where.dueDate.lte = endOfDay(new Date(to));
  }

  const [total, occurrences] = await Promise.all([
    db.occurrence.count({ where }),
    db.occurrence.findMany({
      where,
      include: {
        seva: {
          include: {
            category: true,
            area: true,
            assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
        },
        completedBy: { select: { id: true, name: true } },
        checklists: { include: { checklistItem: true } },
        _count: { select: { files: true } },
      },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    data: occurrences,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});
