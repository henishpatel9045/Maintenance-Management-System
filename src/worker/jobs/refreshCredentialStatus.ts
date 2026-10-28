import { db } from "../../core/db";
import { logger } from "../../core/logger";
import { CredentialService } from "../../modules/contractors/credential.service";

export async function runRefreshCredentialStatus(): Promise<void> {
  logger.info("Executing refreshCredentialStatus job...");

  // Check if contractors module is enabled
  const moduleSetting = await db.setting.findUnique({
    where: { key: "module.contractors.enabled" },
  });
  if (moduleSetting && moduleSetting.value === false) {
    logger.info("Contractors module is disabled; skipping credential refresh.");
    return;
  }

  // Get warn days
  const warnSetting = await db.setting.findUnique({
    where: { key: "contractorExpiryWarnDays" },
  });
  const warnDays = typeof warnSetting?.value === "number" ? warnSetting.value : 30;

  // Find all active credentials
  const credentials = await db.contractorCredential.findMany({
    where: {
      status: { notIn: ["REVOKED", "PENDING_VERIFICATION"] },
      expiresAt: { not: null },
    },
    include: {
      contractor: {
        select: { id: true, code: true, companyName: true },
      },
    },
  });

  let updatedCount = 0;
  let expiredCount = 0;

  for (const cred of credentials) {
    const newStatus = CredentialService.computeStatus(cred.expiresAt, cred.status, warnDays);

    if (newStatus !== cred.status) {
      await db.contractorCredential.update({
        where: { id: cred.id },
        data: { status: newStatus },
      });
      updatedCount++;

      if (newStatus === "EXPIRED" && cred.status !== "EXPIRED") {
        expiredCount++;
      }
    }
  }

  // If credentials expired, notify compliance managers
  if (expiredCount > 0) {
    const managers = await db.user.findMany({
      where: {
        role: { name: { in: ["ADMIN", "COORDINATOR"] } },
        isActive: true,
      },
      select: { id: true },
    });

    if (managers.length > 0) {
      await db.notification.createMany({
        data: managers.map((m) => ({
          userId: m.id,
          type: "CREDENTIAL_EXPIRED_ALERT",
          title: "Contractor Credential Expiry Alert",
          body: `${expiredCount} contractor credential(s) have passed their expiration date.`,
          entityType: "CONTRACTOR_CREDENTIAL",
          linkUrl: "/contractors",
        })),
      });
    }
  }

  logger.info(
    { totalChecked: credentials.length, updatedCount, expiredCount },
    "refreshCredentialStatus job completed"
  );
}

export const refreshCredentialStatus = runRefreshCredentialStatus;
