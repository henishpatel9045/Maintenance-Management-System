import { db } from "../../core/db";
import { logger } from "../../core/logger";
import { countValidHolders, isLicenceValidOnDate } from "../../modules/licences/holder";

export async function runLicenceSnapshot(): Promise<void> {
  logger.info("Executing licenceSnapshot weekly job...");

  const moduleSetting = await db.setting.findUnique({
    where: { key: "module.licences.enabled" },
  });
  if (moduleSetting && moduleSetting.value === false) {
    logger.info("Licences module is disabled; skipping weekly licence snapshot.");
    return;
  }

  const now = new Date();
  const takenOn = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const types = await db.licenceType.findMany({
    where: { isActive: true },
  });

  const allLicences = await db.userLicence.findMany({
    where: {
      archivedAt: null,
      supersededById: null,
      user: { isActive: true },
    },
    include: {
      user: { select: { id: true, isActive: true } },
    },
  });

  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Fetch admin users for deficit alerts
  const admins = await db.user.findMany({
    where: { role: { name: "ADMIN" }, isActive: true },
    select: { id: true },
  });

  for (const type of types) {
    const typeLicences = allLicences.filter((l) => l.licenceTypeId === type.id);

    const validHolders = countValidHolders(typeLicences, now, { includePending: false });

    const expiringSoon = typeLicences.filter((l) => {
      if (!isLicenceValidOnDate(l, now)) return false;
      if (!l.expiresAt) return false;
      const exp = new Date(l.expiresAt);
      return exp >= now && exp <= thirtyDaysFromNow;
    }).length;

    const expired = typeLicences.filter((l) => {
      if (l.status === "EXPIRED") return true;
      if (!l.expiresAt) return false;
      return new Date(l.expiresAt) < now;
    }).length;

    const pending = typeLicences.filter((l) => l.status === "PENDING_VERIFICATION").length;

    await db.licenceCountSnapshot.upsert({
      where: {
        takenOn_licenceTypeId: {
          takenOn,
          licenceTypeId: type.id,
        },
      },
      update: {
        validHolders,
        expiringSoon,
        expired,
        pending,
      },
      create: {
        takenOn,
        licenceTypeId: type.id,
        validHolders,
        expiringSoon,
        expired,
        pending,
      },
    });

    // Below-target notification check
    if (type.minHoldersTarget && type.minHoldersTarget > 0 && validHolders < type.minHoldersTarget) {
      const shortfall = type.minHoldersTarget - validHolders;

      for (const admin of admins) {
        // Send alert if not sent recently
        await db.notification.create({
          data: {
            userId: admin.id,
            type: "LICENCE_BELOW_TARGET",
            title: `Capacity Warning: ${type.name} Below Target`,
            body: `${type.name} currently has ${validHolders} valid holders (target is ${type.minHoldersTarget}, shortfall of ${shortfall}).`,
            entityType: "LICENCE_TYPE",
            entityId: type.id,
            linkUrl: `/licences/summary`,
          },
        });
      }
    }
  }

  logger.info(`Weekly licence snapshot completed for ${types.length} licence types.`);
}

export const licenceSnapshotJob = runLicenceSnapshot;
