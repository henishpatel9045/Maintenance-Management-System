import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { Prisma } from "@prisma/client";
import { toValidUuid } from "@/core/audit/audit";

export const runtime = "nodejs";

export const GET = withAuth("audit.view", async (req) => {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") || undefined;
  const rawEntityId = url.searchParams.get("entityId") || undefined;
  const action = url.searchParams.get("action") || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25", 10)));

  const entityId = rawEntityId ? toValidUuid(rawEntityId) : undefined;

  const where: Prisma.ActivityLogWhereInput = {
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(action ? { action } : {}),
  };

  const [total, logs] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    data: logs,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});
