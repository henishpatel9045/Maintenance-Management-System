import { db } from "../../core/db";
import { logger } from "../../core/logger";

export async function runScheduleLicenceReminders(): Promise<void> {
  logger.info("Executing scheduleLicenceReminders job...");

  const moduleSetting = await db.setting.findUnique({
    where: { key: "module.licences.enabled" },
  });
  if (moduleSetting && moduleSetting.value === false) {
    logger.info("Licences module is disabled; skipping reminders schedule.");
    return;
  }

  // Get reminder intervals: default [60, 30, 7, 0]
  const reminderDaysSetting = await db.setting.findUnique({
    where: { key: "licenceReminderDays" },
  });
  const reminderDays: number[] = Array.isArray(reminderDaysSetting?.value)
    ? (reminderDaysSetting.value as number[])
    : [60, 30, 7, 0];

  // Audience: Holder + users with licences.manage capability
  const managers = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { permissions: { some: { permissionKey: "licences.manage" } } } },
        { permissionOverrides: { some: { permissionKey: "licences.manage", granted: true } } },
      ],
    },
    select: { id: true },
  });
  const managerUserIds = managers.map((m) => m.id);

  // Active licences with an expiry date
  const licences = await db.userLicence.findMany({
    where: {
      archivedAt: null,
      supersededById: null,
      status: { in: ["VALID", "EXPIRING_SOON"] },
      expiresAt: { not: null },
      user: { isActive: true },
    },
    include: {
      user: { select: { id: true, name: true } },
      licenceType: { select: { id: true, name: true } },
    },
  });

  let createdCount = 0;

  for (const lic of licences) {
    if (!lic.expiresAt) continue;
    const expiresAt = lic.expiresAt;

    for (const days of reminderDays) {
      const remindAt = new Date(expiresAt.getTime() - days * 24 * 60 * 60 * 1000);
      const dedupeKey = `licence_${lic.id}_${days}d`;

      const message =
        days === 0
          ? `${lic.user.name}'s ${lic.licenceType.name} licence expires today.`
          : `${lic.user.name}'s ${lic.licenceType.name} licence will expire in ${days} days.`;

      // Audience includes the licence holder and managers
      const audience = Array.from(new Set([lic.userId, ...managerUserIds]));

      const existing = await db.reminder.findUnique({
        where: { dedupeKey },
      });

      if (!existing) {
        await db.reminder.create({
          data: {
            entityType: "USER_LICENCE",
            entityId: lic.id,
            remindAt,
            message,
            audience,
            dedupeKey,
          },
        });
        createdCount++;
      } else if (!existing.sentAt) {
        // Update remindAt / message if expiry date changed
        await db.reminder.update({
          where: { id: existing.id },
          data: { remindAt, message, audience },
        });
      }
    }
  }

  logger.info(`Scheduled licence reminders completed: ${createdCount} new reminders scheduled.`);
}

export const scheduleLicenceRemindersJob = runScheduleLicenceReminders;
