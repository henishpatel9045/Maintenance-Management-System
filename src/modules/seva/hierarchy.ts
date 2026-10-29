import { db } from "../../core/db";
import { AppError } from "../../core/http/error";
import { logAudit } from "../../core/audit/audit";
import { OccurrenceStatus } from "@prisma/client";

export interface SevaRollup {
  sevaId: string;
  descendantCount: number;
  totalOccurrences: number;
  doneOccurrences: number;
  inProgressOccurrences: number;
  pendingOccurrences: number;
  overdueOccurrences: number;
  skippedOccurrences: number;
  cancelledOccurrences: number;
  progressPercent: number;
  derivedStatus: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "OVERDUE";
  earliestStart: Date | null;
  latestDue: Date | null;
  totalEstimatedBudget: number;
  totalApprovedBudget: number;
  totalActualCost: number;
}

export async function computeRollup(sevaId: string): Promise<SevaRollup> {
  const target = await db.seva.findUnique({
    where: { id: sevaId },
    select: { id: true, path: true, isGroup: true, startDate: true, dueDate: true, estimatedBudget: true, approvedBudget: true },
  });

  if (!target) {
    throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");
  }

  // Find all descendants via path prefix
  const subtree = await db.seva.findMany({
    where: {
      path: { startsWith: target.path },
      isArchived: false,
    },
    select: {
      id: true,
      isGroup: true,
      startDate: true,
      dueDate: true,
      estimatedBudget: true,
      approvedBudget: true,
    },
  });

  const descendantIds = subtree.map((s) => s.id);
  const leafIds = subtree.filter((s) => !s.isGroup).map((s) => s.id);

  // Total budgets
  let totalEstimated = 0;
  let totalApproved = 0;
  for (const item of subtree) {
    if (item.estimatedBudget) totalEstimated += Number(item.estimatedBudget);
    if (item.approvedBudget) totalApproved += Number(item.approvedBudget);
  }

  // Get occurrences for leaf nodes
  const occurrences = await db.occurrence.findMany({
    where: {
      sevaId: { in: leafIds },
    },
    select: {
      status: true,
      dueDate: true,
      actualCost: true,
    },
  });

  let total = 0;
  let done = 0;
  let inProgress = 0;
  let pending = 0;
  let overdue = 0;
  let skipped = 0;
  let cancelled = 0;
  let totalActual = 0;

  const now = new Date();

  for (const occ of occurrences) {
    if (occ.actualCost) totalActual += Number(occ.actualCost);

    if (occ.status === OccurrenceStatus.CANCELLED) {
      cancelled++;
      continue;
    }

    total++;
    if (occ.status === OccurrenceStatus.DONE) {
      done++;
    } else if (occ.status === OccurrenceStatus.SKIPPED) {
      skipped++;
    } else if (
      occ.status === OccurrenceStatus.IN_PROGRESS ||
      occ.status === OccurrenceStatus.NEEDS_VERIFICATION
    ) {
      inProgress++;
      if (new Date(occ.dueDate) < now) overdue++;
    } else if (occ.status === OccurrenceStatus.PENDING) {
      pending++;
      if (new Date(occ.dueDate) < now) overdue++;
    }
  }

  const denominator = total - skipped;
  const progressPercent = denominator > 0 ? Math.round((done / denominator) * 100) : (total > 0 && done === total ? 100 : 0);

  let derivedStatus: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "OVERDUE" = "NOT_STARTED";
  if (overdue > 0) {
    derivedStatus = "OVERDUE";
  } else if (progressPercent === 100 && total > 0) {
    derivedStatus = "DONE";
  } else if (inProgress > 0 || done > 0) {
    derivedStatus = "IN_PROGRESS";
  }

  // Compute dates range
  let earliestStart: Date | null = target.startDate;
  let latestDue: Date | null = target.dueDate;

  for (const s of subtree) {
    if (s.startDate && (!earliestStart || s.startDate < earliestStart)) {
      earliestStart = s.startDate;
    }
    if (s.dueDate && (!latestDue || s.dueDate > latestDue)) {
      latestDue = s.dueDate;
    }
  }

  return {
    sevaId,
    descendantCount: Math.max(0, subtree.length - 1),
    totalOccurrences: total,
    doneOccurrences: done,
    inProgressOccurrences: inProgress,
    pendingOccurrences: pending,
    overdueOccurrences: overdue,
    skippedOccurrences: skipped,
    cancelledOccurrences: cancelled,
    progressPercent,
    derivedStatus,
    earliestStart,
    latestDue,
    totalEstimatedBudget: totalEstimated,
    totalApprovedBudget: totalApproved,
    totalActualCost: totalActual,
  };
}

export async function convertLeafToGroup(params: {
  sevaId: string;
  userId: string;
  expectedVersion: number;
}): Promise<void> {
  const { sevaId, userId, expectedVersion } = params;

  await db.$transaction(async (tx) => {
    const seva = await tx.seva.findUnique({
      where: { id: sevaId },
      include: { occurrences: true, recurrenceRule: true },
    });

    if (!seva) throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");
    if (seva.version !== expectedVersion) {
      throw new AppError(409, "VERSION_CONFLICT", "Optimistic lock error: Seva was modified by another transaction");
    }
    if (seva.isGroup) {
      throw new AppError(400, "ALREADY_GROUP", "Seva is already a group container");
    }
    if (seva.kind === "RECURRING" || seva.recurrenceRule) {
      throw new AppError(400, "CANNOT_CONVERT_RECURRING", "A recurring seva can never become a group container");
    }

    // Occurrences must all be PENDING
    const nonPending = seva.occurrences.filter((o) => o.status !== OccurrenceStatus.PENDING);
    if (nonPending.length > 0) {
      throw new AppError(400, "OCCURRENCES_NOT_PENDING", "Cannot convert to group: contains in-progress or completed occurrences");
    }

    // Cancel all pending occurrences
    if (seva.occurrences.length > 0) {
      await tx.occurrence.updateMany({
        where: { sevaId },
        data: { status: OccurrenceStatus.CANCELLED, skipReason: "Cancelled due to conversion to Group container" },
      });
    }

    await tx.seva.update({
      where: { id: sevaId },
      data: {
        isGroup: true,
        version: { increment: 1 },
      },
    });

    await logAudit({
      entityType: "SEVA",
      entityId: sevaId,
      userId,
      action: "CONVERT_TO_GROUP",
      oldValue: { isGroup: false },
      newValue: { isGroup: true },
    });
  });
}

export async function moveSevaSubtree(params: {
  sevaId: string;
  newParentId: string | null;
  expectedVersion: number;
  userId: string;
  maxDepthLimit?: number;
}): Promise<void> {
  const { sevaId, newParentId, expectedVersion, userId, maxDepthLimit = 6 } = params;

  await db.$transaction(async (tx) => {
    // 1. Fetch node to move
    const moving = await tx.seva.findUnique({ where: { id: sevaId } });
    if (!moving) throw new AppError(404, "SEVA_NOT_FOUND", "Moving seva not found");

    if (moving.version !== expectedVersion) {
      throw new AppError(409, "VERSION_CONFLICT", "Seva version mismatch; reload and retry");
    }

    let targetParent: { id: string; path: string; depth: number; isGroup: boolean } | null = null;
    let newPathPrefix = `/${moving.id}/`;
    let newBaseDepth = 0;

    if (newParentId) {
      targetParent = await tx.seva.findUnique({
        where: { id: newParentId },
        select: { id: true, path: true, depth: true, isGroup: true },
      });

      if (!targetParent) {
        throw new AppError(404, "PARENT_NOT_FOUND", "Target parent seva not found");
      }

      // Cycle Protection: Y cannot be X or descendant of X
      if (newParentId === sevaId || targetParent.path.startsWith(moving.path)) {
        throw new AppError(400, "CYCLE_DETECTED", "Cannot move a seva under itself or one of its descendants");
      }

      // Target must be a group or be converted
      if (!targetParent.isGroup) {
        await tx.seva.update({
          where: { id: targetParent.id },
          data: { isGroup: true },
        });
      }

      newBaseDepth = targetParent.depth + 1;
      newPathPrefix = `${targetParent.path}${moving.id}/`;
    }

    // Depth check: fetch moving subtree to compute max resulting depth
    const subtree = await tx.seva.findMany({
      where: { path: { startsWith: moving.path } },
      select: { id: true, path: true, depth: true },
    });

    const depthDelta = newBaseDepth - moving.depth;
    for (const node of subtree) {
      const resultingDepth = node.depth + depthDelta;
      if (resultingDepth > maxDepthLimit) {
        throw new AppError(
          400,
          "MAX_DEPTH_EXCEEDED",
          `Moving this subtree would exceed the maximum depth limit of ${maxDepthLimit} (resulting depth: ${resultingDepth})`
        );
      }
    }

    // Rewrite paths and depths
    const oldPathPrefix = moving.path;
    for (const node of subtree) {
      const relativePath = node.path.slice(oldPathPrefix.length);
      const updatedPath = `${newPathPrefix}${relativePath}`;
      const updatedDepth = node.depth + depthDelta;

      await tx.seva.update({
        where: { id: node.id },
        data: {
          path: updatedPath,
          depth: updatedDepth,
          parentId: node.id === moving.id ? newParentId : undefined,
          version: node.id === moving.id ? { increment: 1 } : undefined,
        },
      });
    }

    await logAudit({
      entityType: "SEVA",
      entityId: sevaId,
      userId,
      action: "MOVE_SEVA",
      oldValue: { parentId: moving.parentId, path: moving.path, depth: moving.depth },
      newValue: { parentId: newParentId, path: newPathPrefix, depth: newBaseDepth },
    });
  });
}

export async function archiveSevaSubtree(params: {
  sevaId: string;
  userId: string;
  archiveSubtree?: boolean;
}): Promise<{ count: number }> {
  const { sevaId, userId, archiveSubtree = true } = params;

  return await db.$transaction(async (tx) => {
    const seva = await tx.seva.findUnique({ where: { id: sevaId } });
    if (!seva) throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");

    let whereClause: any = { id: sevaId };
    if (archiveSubtree) {
      whereClause = {
        OR: [{ id: sevaId }, { path: { startsWith: seva.path } }],
      };
    }

    const result = await tx.seva.updateMany({
      where: whereClause,
      data: { isArchived: true },
    });

    await logAudit({
      entityType: "SEVA",
      entityId: sevaId,
      userId,
      action: "ARCHIVE_SEVA",
      newValue: { archivedCount: result.count, subtree: archiveSubtree },
    });

    return { count: result.count };
  });
}

export async function unarchiveSevaSubtree(params: {
  sevaId: string;
  userId: string;
  unarchiveSubtree?: boolean;
}): Promise<{ count: number }> {
  const { sevaId, userId, unarchiveSubtree = true } = params;

  return await db.$transaction(async (tx) => {
    const seva = await tx.seva.findUnique({ where: { id: sevaId } });
    if (!seva) throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");

    let whereClause: any = { id: sevaId };
    if (unarchiveSubtree) {
      whereClause = {
        OR: [{ id: sevaId }, { path: { startsWith: seva.path } }],
      };
    }

    const result = await tx.seva.updateMany({
      where: whereClause,
      data: { isArchived: false },
    });

    await logAudit({
      entityType: "SEVA",
      entityId: sevaId,
      userId,
      action: "UNARCHIVE_SEVA",
      newValue: { unarchivedCount: result.count, subtree: unarchiveSubtree },
    });

    return { count: result.count };
  });
}
