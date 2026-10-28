import { db } from "@/core/db";
import { logAudit } from "@/core/audit/audit";
import { UserAvailabilityStatus } from "@prisma/client";

export class AvailabilityService {
  /**
   * Retrieves availability for a user.
   */
  static async getUserAvailability(userId: string) {
    const record = await db.userAvailability.findUnique({
      where: { userId },
    });

    if (!record) {
      return {
        userId,
        status: "AVAILABLE",
        note: null,
        availableUntil: null,
      };
    }

    return record;
  }

  /**
   * Updates availability for a user.
   */
  static async setUserAvailability(
    targetUserId: string,
    data: {
      status: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
      note?: string | null;
      availableUntil?: string | null;
    },
    actorUserId: string
  ) {
    const updated = await db.userAvailability.upsert({
      where: { userId: targetUserId },
      update: {
        status: data.status as UserAvailabilityStatus,
        note: data.note !== undefined ? data.note : null,
        availableUntil: data.availableUntil ? new Date(data.availableUntil) : null,
      },
      create: {
        userId: targetUserId,
        status: data.status as UserAvailabilityStatus,
        note: data.note || null,
        availableUntil: data.availableUntil ? new Date(data.availableUntil) : null,
      },
    });

    await logAudit({
      entityType: "USER",
      entityId: targetUserId,
      userId: actorUserId,
      action: "UPDATE_AVAILABILITY",
      newValue: {
        status: updated.status,
        note: updated.note,
        availableUntil: updated.availableUntil,
      },
    });

    return updated;
  }
}
