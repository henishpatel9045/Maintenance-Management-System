import { db } from "../../core/db";
import { logger } from "../../core/logger";
import { SevaLicenceService } from "../../modules/licences/seva.service";

export async function runCheckUpcomingSevaLicences(): Promise<void> {
  logger.info("Executing checkUpcomingSevaLicences daily job...");

  const moduleSetting = await db.setting.findUnique({
    where: { key: "module.licences.enabled" },
  });
  if (moduleSetting && moduleSetting.value === false) {
    logger.info("Licences module is disabled; skipping seva licence compliance check.");
    return;
  }

  const now = new Date();
  const next14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Find upcoming occurrences for seva with required licences
  const occurrences = await db.occurrence.findMany({
    where: {
      dueDate: { gte: now, lte: next14Days },
      status: { in: ["PENDING", "IN_PROGRESS"] },
      seva: {
        isArchived: false,
        requiredLicences: { some: {} },
      },
    },
    include: {
      seva: {
        include: {
          requiredLicences: { include: { licenceType: true } },
          assignees: { include: { user: true } },
        },
      },
    },
  });

  const managers = await db.user.findMany({
    where: {
      role: { name: { in: ["ADMIN", "COORDINATOR"] } },
      isActive: true,
    },
    select: { id: true },
  });

  let warningCount = 0;

  for (const occ of occurrences) {
    const compliance = await SevaLicenceService.checkSevaLicenceCompliance(
      occ.sevaId,
      new Date(occ.dueDate)
    );

    if (!compliance.isCompliant) {
      warningCount++;
      const formattedDate = new Date(occ.dueDate).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
      });

      // Notify managers
      for (const m of managers) {
        await db.notification.create({
          data: {
            userId: m.id,
            type: "SEVA_LICENCE_NON_COMPLIANT",
            title: `Licence Requirement Gap: ${occ.seva.code}`,
            body: `${occ.seva.title} due on ${formattedDate}: ${compliance.bannerMessage}`,
            entityType: "SEVA",
            entityId: occ.seva.id,
            linkUrl: `/seva/${occ.seva.id}`,
          },
        });
      }
    }
  }

  logger.info(`Upcoming seva licence compliance check completed: ${warningCount} non-compliant tasks flagged.`);
}

export const checkUpcomingSevaLicencesJob = runCheckUpcomingSevaLicences;
