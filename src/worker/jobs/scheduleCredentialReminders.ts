import { db } from "../../core/db";
import { logger } from "../../core/logger";

export async function runScheduleCredentialReminders(): Promise<void> {
  logger.info("Executing scheduleCredentialReminders job...");

  const moduleSetting = await db.setting.findUnique({
    where: { key: "module.contractors.enabled" },
  });
  if (moduleSetting && moduleSetting.value === false) {
    logger.info("Contractors module is disabled; skipping credential reminders schedule.");
    return;
  }

  // Get reminder intervals setting: default [60, 30, 7, 0]
  const reminderDaysSetting = await db.setting.findUnique({
    where: { key: "contractorReminderDays" },
  });
  const reminderDays: number[] = Array.isArray(reminderDaysSetting?.value)
    ? (reminderDaysSetting.value as number[])
    : [60, 30, 7, 0];

  // Find audience: users with credentials management capability (coordinators and admins)
  const managers = await db.user.findMany({
    where: {
      role: { name: { in: ["ADMIN", "COORDINATOR"] } },
      isActive: true,
    },
    select: { id: true },
  });
  const audienceUserIds = managers.map((m) => m.id);
  if (audienceUserIds.length === 0) {
    logger.warn("No active managers found for credential reminders audience.");
    return;
  }

  // 1. Process Contractor Credentials
  const credentials = await db.contractorCredential.findMany({
    where: {
      status: { notIn: ["REVOKED"] },
      expiresAt: { not: null },
      contractor: { archivedAt: null },
    },
    include: {
      contractor: { select: { id: true, code: true, companyName: true } },
    },
  });

  let createdCount = 0;

  for (const cred of credentials) {
    if (!cred.expiresAt) continue;
    const expiresAt = cred.expiresAt;

    for (const days of reminderDays) {
      const remindAt = new Date(expiresAt.getTime() - days * 24 * 60 * 60 * 1000);
      const dedupeKey = `contractor_cred_${cred.id}_${days}d`;

      const message =
        days === 0
          ? `${cred.contractor.companyName} (${cred.contractor.code}) credential "${cred.type}" expires today!`
          : `${cred.contractor.companyName} (${cred.contractor.code}) credential "${cred.type}" expires in ${days} days (${expiresAt.toISOString().slice(0, 10)}).`;

      // Upsert to ensure reruns never duplicate and date updates are reflected
      await db.reminder.upsert({
        where: { dedupeKey },
        create: {
          entityType: "CONTRACTOR_CREDENTIAL",
          entityId: cred.contractorId,
          remindAt,
          message,
          audience: { userIds: audienceUserIds },
          dedupeKey,
        },
        update: {
          remindAt,
          message,
          audience: { userIds: audienceUserIds },
        },
      });

      createdCount++;
    }
  }

  // 2. Process Expiring Contractor File Links
  const fileLinks = await db.fileLink.findMany({
    where: {
      entityType: "CONTRACTOR",
      expiresAt: { not: null },
    },
    include: {
      fileObject: true,
    },
  });

  for (const fileLink of fileLinks) {
    if (!fileLink.expiresAt) continue;
    const expiresAt = fileLink.expiresAt;

    for (const days of reminderDays) {
      const remindAt = new Date(expiresAt.getTime() - days * 24 * 60 * 60 * 1000);
      const dedupeKey = `contractor_file_${fileLink.id}_${days}d`;

      const label = fileLink.label || fileLink.fileObject.originalName;
      const message =
        days === 0
          ? `Contractor document "${label}" expires today!`
          : `Contractor document "${label}" expires in ${days} days (${expiresAt.toISOString().slice(0, 10)}).`;

      await db.reminder.upsert({
        where: { dedupeKey },
        create: {
          entityType: "CONTRACTOR",
          entityId: fileLink.entityId,
          remindAt,
          message,
          audience: { userIds: audienceUserIds },
          dedupeKey,
        },
        update: {
          remindAt,
          message,
          audience: { userIds: audienceUserIds },
        },
      });

      createdCount++;
    }
  }

  // 3. Cleanup reminders for revoked credentials
  const revokedCreds = await db.contractorCredential.findMany({
    where: { status: "REVOKED" },
    select: { id: true },
  });

  if (revokedCreds.length > 0) {
    for (const rc of revokedCreds) {
      await db.reminder.deleteMany({
        where: {
          dedupeKey: { startsWith: `contractor_cred_${rc.id}_` },
          sentAt: null,
        },
      });
    }
  }

  logger.info({ createdOrUpdated: createdCount }, "scheduleCredentialReminders job completed");
}

export const scheduleCredentialReminders = runScheduleCredentialReminders;
