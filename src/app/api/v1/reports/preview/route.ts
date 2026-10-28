import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { computeKpis } from "@/modules/dashboard/kpi";
import { can } from "@/core/permissions/can";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const reportFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  rootSevaId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  kind: z.string().optional(),
}).strict();

export const POST = withAuth("reports.view", async (req, { user }) => {
  const body = await validateBody(reportFilterSchema, req);
  const canViewQuotes = can(user, "quotes.view");

  const { metrics, charts } = await computeKpis(body);

  // Fetch detailed occurrence rows
  let allowedSevaIds: string[] | null = null;
  if (body.rootSevaId) {
    const root = await db.seva.findUnique({
      where: { id: body.rootSevaId },
      select: { path: true },
    });
    if (root) {
      const subtree = await db.seva.findMany({
        where: { path: { startsWith: root.path } },
        select: { id: true },
      });
      allowedSevaIds = subtree.map((s) => s.id);
    }
  }

  const where: Prisma.OccurrenceWhereInput = {
    seva: {
      isArchived: false,
      ...(allowedSevaIds ? { id: { in: allowedSevaIds } } : {}),
      ...(body.categoryId ? { categoryId: body.categoryId } : {}),
      ...(body.areaId ? { areaId: body.areaId } : {}),
      ...(body.assigneeId ? { assignees: { some: { userId: body.assigneeId } } } : {}),
      ...(body.kind ? { kind: body.kind as any } : {}),
    },
    ...(body.from || body.to
      ? {
          dueDate: {
            ...(body.from ? { gte: new Date(body.from) } : {}),
            ...(body.to ? { lte: new Date(body.to) } : {}),
          },
        }
      : {}),
  };

  const occurrences = await db.occurrence.findMany({
    where,
    include: {
      seva: {
        include: {
          category: { select: { name: true } },
          area: { select: { name: true } },
          assignees: { include: { user: { select: { name: true } } } },
        },
      },
      completedBy: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const detailRows = occurrences.map((occ) => ({
    id: occ.id,
    code: occ.seva.code,
    title: occ.seva.title,
    category: occ.seva.category.name,
    area: occ.seva.area.name,
    dueDate: format(new Date(occ.dueDate), "yyyy-MM-dd"),
    status: occ.status,
    assignees: occ.seva.assignees.map((a) => a.user.name).join(", "),
    completedAt: occ.completedAt ? format(new Date(occ.completedAt), "yyyy-MM-dd") : "-",
    completedBy: occ.completedBy?.name ?? "-",
    actualCost: canViewQuotes && occ.actualCost ? Number(occ.actualCost) : null,
  }));

  return NextResponse.json({
    data: {
      metrics,
      charts,
      detailRows,
    },
  });
});
