import { OccurrenceStatus } from "@prisma/client";
import { db } from "../../core/db";
import { AppError } from "../../core/http/error";
import { logAudit } from "../../core/audit/audit";
import { handleOccurrenceCompleted } from "./recurrence";
import { AuthenticatedUser } from "../../core/permissions/can";

export interface UpdateOccurrenceStatusInput {
  occurrenceId: string;
  status: OccurrenceStatus;
  expectedVersion: number;
  user: AuthenticatedUser;
  skipReason?: string;
  completionNote?: string;
  actualCost?: number;
}

export async function updateOccurrenceStatus(input: UpdateOccurrenceStatusInput): Promise<void> {
  const { occurrenceId, status, expectedVersion, user, skipReason, completionNote, actualCost } = input;

  await db.$transaction(async (tx) => {
    const occ = await tx.occurrence.findUnique({
      where: { id: occurrenceId },
      include: {
        seva: {
          include: {
            assignees: true,
          },
        },
      },
    });

    if (!occ) {
      throw new AppError(404, "OCCURRENCE_NOT_FOUND", "Occurrence not found");
    }

    if (occ.version !== expectedVersion) {
      throw new AppError(409, "VERSION_CONFLICT", "Occurrence has been modified by another user. Please refresh.");
    }

    const currentStatus = occ.status;

    // Rules:
    // 1. If currently DONE, only ADMIN can reopen
    if (currentStatus === OccurrenceStatus.DONE && status !== OccurrenceStatus.DONE) {
      if (user.role !== "ADMIN") {
        throw new AppError(403, "FORBIDDEN", "Completed occurrences are locked; only administrators can reopen them");
      }
    }

    // 2. SKIP requires reason
    if (status === OccurrenceStatus.SKIPPED && (!skipReason || skipReason.trim().length === 0)) {
      throw new AppError(400, "SKIP_REASON_REQUIRED", "A valid reason must be provided when skipping an occurrence");
    }

    // 3. Status transition verification logic
    let targetStatus = status;
    if (status === OccurrenceStatus.DONE && occ.seva.requiresVerification && user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      targetStatus = OccurrenceStatus.NEEDS_VERIFICATION;
    }

    const now = new Date();
    const updateData: any = {
      status: targetStatus,
      version: { increment: 1 },
      updatedAt: now,
    };

    if (targetStatus === OccurrenceStatus.IN_PROGRESS && !occ.startedAt) {
      updateData.startedAt = now;
    }

    if (targetStatus === OccurrenceStatus.DONE) {
      updateData.completedAt = now;
      updateData.completedById = user.id;
      if (completionNote) updateData.completionNote = completionNote;
      if (actualCost !== undefined) updateData.actualCost = actualCost;
    }

    if (targetStatus === OccurrenceStatus.SKIPPED) {
      updateData.skipReason = skipReason;
    }

    await tx.occurrence.update({
      where: { id: occurrenceId },
      data: updateData,
    });

    // Write audit log
    await logAudit({
      entityType: "OCCURRENCE",
      entityId: occurrenceId,
      occurrenceId,
      userId: user.id,
      action: "UPDATE_STATUS",
      oldValue: { status: currentStatus },
      newValue: { status: targetStatus, note: completionNote, skipReason },
    });

    // Notify assignees if status changed
    const notifyUserIds = occ.seva.assignees
      .map((a) => a.userId)
      .filter((uid) => uid !== user.id);

    if (notifyUserIds.length > 0) {
      await tx.notification.createMany({
        data: notifyUserIds.map((userId) => ({
          userId,
          type: "OCCURRENCE_STATUS_CHANGED",
          title: `Status update: ${occ.seva.title}`,
          body: `${user.name} changed status from ${currentStatus} to ${targetStatus}`,
          entityType: "OCCURRENCE",
          entityId: occurrenceId,
          linkUrl: `/seva/${occ.sevaId}`,
        })),
      });
    }
  });

  // Handle floating recurrence trigger if DONE
  if (status === OccurrenceStatus.DONE) {
    await handleOccurrenceCompleted(occurrenceId);
  }
}
