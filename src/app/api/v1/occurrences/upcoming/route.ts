import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { OccurrenceStatus } from "@prisma/client";
import { startOfDay, addDays, format } from "date-fns";

export const runtime = "nodejs";

export const GET = withAuth("seva.read", async (req, { user }) => {
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(7, parseInt(url.searchParams.get("days") || "30", 10)));
  const mine = url.searchParams.get("mine") === "true";

  const today = startOfDay(new Date());
  const until = addDays(today, days);

  const occurrences = await db.occurrence.findMany({
    where: {
      dueDate: { gte: today, lte: until },
      status: { notIn: [OccurrenceStatus.CANCELLED, OccurrenceStatus.SKIPPED] },
      seva: {
        isArchived: false,
        ...(mine ? { assignees: { some: { userId: user.id } } } : {}),
      },
    },
    include: {
      seva: {
        include: {
          category: true,
          area: true,
          assignees: { include: { user: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Group by date (YYYY-MM-DD)
  const grouped = new Map<string, typeof occurrences>();
  for (const occ of occurrences) {
    const key = format(new Date(occ.dueDate), "yyyy-MM-dd");
    const list = grouped.get(key) || [];
    list.push(occ);
    grouped.set(key, list);
  }

  const result = Array.from(grouped.entries()).map(([date, items]) => ({
    date,
    count: items.length,
    items,
  }));

  return NextResponse.json({ data: result });
});
