import { db } from "../../core/db";
import { logger } from "../../core/logger";

export async function runDispatchReminders(): Promise<void> {
  logger.info("Executing reminder dispatch job...");
  const now = new Date();

  const pendingReminders = await db.reminder.findMany({
    where: {
      remindAt: { lte: now },
      sentAt: null,
    },
    take: 50,
  });

  for (const rem of pendingReminders) {
    try {
      const audience = rem.audience as { userIds?: string[] };
      const userIds = audience.userIds || [];

      if (userIds.length > 0) {
        await db.notification.createMany({
          data: userIds.map((userId) => ({
            userId,
            type: "REMINDER",
            title: "Task Reminder",
            body: rem.message,
            entityType: rem.entityType,
            entityId: rem.entityId,
            linkUrl: `/seva/${rem.entityId}`,
          })),
        });
      }

      await db.reminder.update({
        where: { id: rem.id },
        data: { sentAt: now },
      });
    } catch (err) {
      logger.error({ err, reminderId: rem.id }, "Failed dispatching reminder");
    }
  }

  logger.info({ dispatched: pendingReminders.length }, "Reminders dispatch complete");
}
