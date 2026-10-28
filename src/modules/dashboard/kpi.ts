import { OccurrenceStatus, Prisma } from "@prisma/client";
import { startOfDay, endOfDay, isBefore, isAfter, differenceInCalendarDays, startOfWeek, endOfWeek } from "date-fns";
import { db } from "../../core/db";

export interface KpiFilterParams {
  from?: string | Date;
  to?: string | Date;
  rootSevaId?: string;
  includeDescendants?: boolean;
  categoryId?: string;
  areaId?: string;
  priority?: string;
  assigneeId?: string;
  tagId?: string;
  kind?: string;
}

export interface KpiMetrics {
  total: number;
  done: number;
  inProgress: number;
  pending: number;
  overdue: number;
  skipped: number;
  cancelled: number;
  completionPercent: number;
  onTimePercent: number;
  averageCompletionDays: number;
  dueToday: number;
  dueThisWeek: number;
  totalBudget: number;
  totalSpend: number;
}

export interface ChartDatasets {
  statusDonut: Array<{ label: string; value: number; color: string }>;
  byCategory: Array<{ label: string; count: number; spend: number }>;
  byArea: Array<{ label: string; count: number; overdue: number }>;
  completedPerWeek: Array<{ week: string; count: number }>;
  workloadPerAssignee: Array<{ name: string; assigned: number; done: number }>;
  spendByCategory: Array<{ category: string; spend: number }>;
}

export async function computeKpis(params: KpiFilterParams): Promise<{
  metrics: KpiMetrics;
  charts: ChartDatasets;
}> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // 1. Resolve scope if rootSevaId provided
  let allowedSevaIds: string[] | null = null;
  if (params.rootSevaId) {
    const root = await db.seva.findUnique({
      where: { id: params.rootSevaId },
      select: { id: true, path: true },
    });
    if (root) {
      if (params.includeDescendants !== false) {
        const subtree = await db.seva.findMany({
          where: { OR: [{ id: root.id }, { path: { startsWith: root.path } }] },
          select: { id: true },
        });
        allowedSevaIds = subtree.map((s) => s.id);
      } else {
        allowedSevaIds = [root.id];
      }
    }
  }

  // 2. Build where filter for occurrences
  const where: Prisma.OccurrenceWhereInput = {
    seva: {
      isArchived: false,
      ...(allowedSevaIds ? { id: { in: allowedSevaIds } } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.areaId ? { areaId: params.areaId } : {}),
      ...(params.priority ? { priority: params.priority as any } : {}),
      ...(params.kind ? { kind: params.kind as any } : {}),
      ...(params.assigneeId ? { assignees: { some: { userId: params.assigneeId } } } : {}),
      ...(params.tagId ? { tags: { some: { tagId: params.tagId } } } : {}),
    },
  };

  if (params.from || params.to) {
    where.dueDate = {};
    if (params.from) where.dueDate.gte = startOfDay(new Date(params.from));
    if (params.to) where.dueDate.lte = endOfDay(new Date(params.to));
  }

  const occurrences = await db.occurrence.findMany({
    where,
    include: {
      seva: {
        include: {
          category: true,
          area: true,
          assignees: { include: { user: true } },
        },
      },
    },
  });

  let total = 0;
  let done = 0;
  let inProgress = 0;
  let pending = 0;
  let overdue = 0;
  let skipped = 0;
  let cancelled = 0;
  let doneOnTime = 0;
  let totalDaysToComplete = 0;
  let dueToday = 0;
  let dueThisWeek = 0;
  let totalSpend = 0;

  const categoryCounts = new Map<string, { count: number; spend: number }>();
  const areaCounts = new Map<string, { count: number; overdue: number }>();
  const assigneeWorkload = new Map<string, { assigned: number; done: number }>();
  const weekBuckets = new Map<string, number>();

  for (const occ of occurrences) {
    const due = new Date(occ.dueDate);
    const catName = occ.seva.category.name;
    const areaName = occ.seva.area.name;
    const actualCost = occ.actualCost ? Number(occ.actualCost) : 0;
    totalSpend += actualCost;

    // Track category spend & counts
    const catEntry = categoryCounts.get(catName) || { count: 0, spend: 0 };
    catEntry.count++;
    catEntry.spend += actualCost;
    categoryCounts.set(catName, catEntry);

    // Track area
    const areaEntry = areaCounts.get(areaName) || { count: 0, overdue: 0 };
    areaEntry.count++;

    // Track assignees
    for (const a of occ.seva.assignees) {
      const uName = a.user.name;
      const wEntry = assigneeWorkload.get(uName) || { assigned: 0, done: 0 };
      wEntry.assigned++;
      if (occ.status === OccurrenceStatus.DONE) {
        wEntry.done++;
      }
      assigneeWorkload.set(uName, wEntry);
    }

    if (occ.status === OccurrenceStatus.CANCELLED) {
      cancelled++;
      continue;
    }

    total++;

    const isDueBeforeNow = isBefore(due, todayStart);
    const isToday = !isBefore(due, todayStart) && !isAfter(due, todayEnd);
    const isThisWeek = !isBefore(due, thisWeekStart) && !isAfter(due, thisWeekEnd);

    if (isToday) dueToday++;
    if (isThisWeek) dueThisWeek++;

    if (occ.status === OccurrenceStatus.DONE) {
      done++;
      if (occ.completedAt) {
        if (!isAfter(new Date(occ.completedAt), endOfDay(due))) {
          doneOnTime++;
        }
        const start = occ.startedAt ? new Date(occ.startedAt) : due;
        const diff = Math.max(0, differenceInCalendarDays(new Date(occ.completedAt), start));
        totalDaysToComplete += diff;

        // Group into week for time series
        const weekKey = `${occ.completedAt.getFullYear()}-W${Math.ceil(occ.completedAt.getDate() / 7)}`;
        weekBuckets.set(weekKey, (weekBuckets.get(weekKey) || 0) + 1);
      }
    } else if (occ.status === OccurrenceStatus.SKIPPED) {
      skipped++;
    } else if (
      occ.status === OccurrenceStatus.IN_PROGRESS ||
      occ.status === OccurrenceStatus.NEEDS_VERIFICATION
    ) {
      inProgress++;
      if (isDueBeforeNow) {
        overdue++;
        areaEntry.overdue++;
      }
    } else if (occ.status === OccurrenceStatus.PENDING) {
      if (isDueBeforeNow) {
        overdue++;
        areaEntry.overdue++;
      } else {
        pending++;
      }
    }

    areaCounts.set(areaName, areaEntry);
  }

  // Calculate unique seva budget
  const uniqueSevaIds = Array.from(new Set(occurrences.map((o) => o.sevaId)));
  const sevas = await db.seva.findMany({
    where: { id: { in: uniqueSevaIds } },
    select: { approvedBudget: true, estimatedBudget: true },
  });
  let totalBudget = 0;
  for (const s of sevas) {
    if (s.approvedBudget) totalBudget += Number(s.approvedBudget);
    else if (s.estimatedBudget) totalBudget += Number(s.estimatedBudget);
  }

  const denominator = total - skipped;
  const completionPercent = denominator > 0 ? Math.round((done / denominator) * 100) : (total > 0 && done === total ? 100 : 0);
  const onTimePercent = done > 0 ? Math.round((doneOnTime / done) * 100) : 0;
  const averageCompletionDays = done > 0 ? Number((totalDaysToComplete / done).toFixed(1)) : 0;

  // Chart datasets
  const statusDonut = [
    { label: "Done", value: done, color: "#10b981" },
    { label: "In Progress", value: inProgress, color: "#06b6d4" },
    { label: "Pending", value: pending, color: "#64748b" },
    { label: "Overdue", value: overdue, color: "#dc2626" },
    { label: "Skipped", value: skipped, color: "#94a3b8" },
  ].filter((s) => s.value > 0);

  const byCategory = Array.from(categoryCounts.entries()).map(([label, data]) => ({
    label,
    count: data.count,
    spend: data.spend,
  }));

  const byArea = Array.from(areaCounts.entries())
    .map(([label, data]) => ({ label, count: data.count, overdue: data.overdue }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const completedPerWeek = Array.from(weekBuckets.entries()).map(([week, count]) => ({
    week,
    count,
  }));

  const workloadPerAssignee = Array.from(assigneeWorkload.entries()).map(([name, data]) => ({
    name,
    assigned: data.assigned,
    done: data.done,
  }));

  const spendByCategory = Array.from(categoryCounts.entries()).map(([category, data]) => ({
    category,
    spend: data.spend,
  }));

  return {
    metrics: {
      total,
      done,
      inProgress,
      pending,
      overdue,
      skipped,
      cancelled,
      completionPercent,
      onTimePercent,
      averageCompletionDays,
      dueToday,
      dueThisWeek,
      totalBudget,
      totalSpend,
    },
    charts: {
      statusDonut,
      byCategory,
      byArea,
      completedPerWeek,
      workloadPerAssignee,
      spendByCategory,
    },
  };
}
