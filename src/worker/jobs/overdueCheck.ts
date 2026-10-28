import { db } from "../../core/db";
import { logger } from "../../core/logger";
import { startOfDay } from "date-fns";
import { OccurrenceStatus } from "@prisma/client";

export async function runHourlyOverdueCheck(): Promise<void> {
  logger.info("Executing hourly overdue check...");
  const todayStart = startOfDay(new Date());

  const overdueOccurrences = await db.occurrence.findMany({
    where: {
      dueDate: { lt: todayStart },
      status: { in: [OccurrenceStatus.PENDING, OccurrenceStatus.IN_PROGRESS] },
      seva: { isArchived: false },
    },
    include: {
      seva: {
        include: {
          assignees: true,
        },
      },
    },
  });

  for (const occ of overdueOccurrences) {
    for (const a of occ.seva.assignees) {
      // Deduplicate: check if notification already sent today
      const existing = await db.notification.findFirst({
        where: {
          userId: a.userId,
          entityId: occ.id,
          type: "OCCURRENCE_OVERDUE",
          createdAt: { gte: todayStart },
        },
      });

      if (!existing) {
        await db.notification.create({
          data: {
            userId: a.userId,
            type: "OCCURRENCE_OVERDUE",
            title: `Task Overdue: ${occ.seva.title}`,
            body: `Seva ${occ.seva.code} was due on ${occ.dueDate.toLocaleDateString()} and is now overdue`,
            entityType: "OCCURRENCE",
            entityId: occ.id,
            linkUrl: `/seva/${occ.sevaId}`,
          },
        });
      }
    }
  }

  logger.info({ overdueCount: overdueOccurrences.length }, "Hourly overdue check completed");
}
