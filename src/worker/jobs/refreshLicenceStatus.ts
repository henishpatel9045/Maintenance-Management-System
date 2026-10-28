import { db } from "../../core/db";
import { logger } from "../../core/logger";
import { UserLicenceStatus } from "@prisma/client";

export async function runRefreshLicenceStatus(): Promise<void> {
  logger.info("Executing refreshLicenceStatus job...");

  const moduleSetting = await db.setting.findUnique({
    where: { key: "module.licences.enabled" },
  });
  if (moduleSetting && moduleSetting.value === false) {
    logger.info("Licences module is disabled; skipping licence status refresh.");
    return;
  }

  // 1. Revert expired availability windows
  const now = new Date();
  const expiredAvailabilities = await db.userAvailability.updateMany({
    where: {
      availableUntil: { lte: now },
      status: { not: "AVAILABLE" },
    },
    data: {
      status: "AVAILABLE",
      note: null,
      availableUntil: null,
    },
  });

  if (expiredAvailabilities.count > 0) {
    logger.info(`Reverted ${expiredAvailabilities.count} expired user availability windows back to AVAILABLE.`);
  }

  // 2. Fetch warning threshold (default 30 days)
  const warnSetting = await db.setting.findUnique({
    where: { key: "licenceExpiryWarnDays" },
  });
  const warnDays = typeof warnSetting?.value === "number" ? warnSetting.value : 30;

  // 3. Find active licences with expiry dates
  const licences = await db.userLicence.findMany({
    where: {
      archivedAt: null,
      supersededById: null,
      status: { in: [UserLicenceStatus.VALID, UserLicenceStatus.EXPIRING_SOON, UserLicenceStatus.EXPIRED] },
      expiresAt: { not: null },
    },
    include: {
      user: { select: { id: true, name: true, isActive: true } },
      licenceType: { select: { id: true, name: true } },
    },
  });

  let updatedCount = 0;
  const nowTime = now.getTime();
  const warnThresholdTime = nowTime + warnDays * 24 * 60 * 60 * 1000;

  for (const lic of licences) {
    if (!lic.expiresAt) continue;
    const expTime = new Date(lic.expiresAt).getTime();

    let newStatus: UserLicenceStatus;
    if (expTime < nowTime) {
      newStatus = UserLicenceStatus.EXPIRED;
    } else if (expTime <= warnThresholdTime) {
      newStatus = UserLicenceStatus.EXPIRING_SOON;
    } else {
      newStatus = UserLicenceStatus.VALID;
    }

    if (newStatus !== lic.status) {
      await db.userLicence.update({
        where: { id: lic.id },
        data: { status: newStatus },
      });
      updatedCount++;

      // Notify holder on status change to EXPIRING_SOON or EXPIRED
      if (newStatus === UserLicenceStatus.EXPIRING_SOON || newStatus === UserLicenceStatus.EXPIRED) {
        const title =
          newStatus === UserLicenceStatus.EXPIRED
            ? `Licence Expired: ${lic.licenceType.name}`
            : `Licence Expiring Soon: ${lic.licenceType.name}`;

        const body =
          newStatus === UserLicenceStatus.EXPIRED
            ? `Your ${lic.licenceType.name} licence has expired. Please renew your licence.`
            : `Your ${lic.licenceType.name} licence will expire within ${warnDays} days. Please prepare your renewal.`;

        await db.notification.create({
          data: {
            userId: lic.userId,
            type: "LICENCE_EXPIRY_ALERT",
            title,
            body,
            entityType: "USER_LICENCE",
            entityId: lic.id,
            linkUrl: "/licences/my",
          },
        });
      }
    }
  }

  logger.info(`Licence status refresh completed: ${updatedCount} licence records updated.`);
}

export const refreshLicenceStatusJob = runRefreshLicenceStatus;
