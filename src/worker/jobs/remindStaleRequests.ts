import { db } from "../../core/db";
import { logger } from "../../core/logger";

export async function runRemindStaleRequests(): Promise<void> {
  logger.info("Executing remindStaleRequests job...");

  const moduleSetting = await db.setting.findUnique({
    where: { key: "module.contractors.enabled" },
  });
  if (moduleSetting && moduleSetting.value === false) {
    logger.info("Contractors module is disabled; skipping stale requests reminder.");
    return;
  }

  // Get stale threshold in days (default 7)
  const staleDaysSetting = await db.setting.findUnique({
    where: { key: "contractorRequestReminderDays" },
  });
  const staleDays = typeof staleDaysSetting?.value === "number" ? staleDaysSetting.value : 7;

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - staleDays);

  const staleRequests = await db.contractorRequest.findMany({
    where: {
      status: "OPEN",
      createdAt: { lte: staleDate },
    },
    include: {
      requestedBy: { select: { name: true } },
    },
  });

  if (staleRequests.length === 0) {
    logger.info("No stale open contractor requests found.");
    return;
  }

  const reviewers = await db.user.findMany({
    where: {
      role: { name: { in: ["ADMIN", "COORDINATOR"] } },
      isActive: true,
    },
    select: { id: true },
  });

  if (reviewers.length === 0) return;

  const todayStr = new Date().toISOString().slice(0, 10);

  let notifiedCount = 0;
  for (const req of staleRequests) {
    // Check if notification already sent today for this request
    const existingNotif = await db.notification.findFirst({
      where: {
        entityType: "CONTRACTOR_REQUEST",
        entityId: req.id,
        type: "STALE_REQUEST_REMINDER",
        createdAt: {
          gte: new Date(todayStr),
        },
      },
    });

    if (!existingNotif) {
      await db.notification.createMany({
        data: reviewers.map((r) => ({
          userId: r.id,
          type: "STALE_REQUEST_REMINDER",
          title: `Stale Contractor Request: ${req.code}`,
          body: `Request has been OPEN for more than ${staleDays} days (Submitted by ${req.requestedBy.name}).`,
          entityType: "CONTRACTOR_REQUEST",
          entityId: req.id,
          linkUrl: `/contractors/requests/${req.id}`,
        })),
      });
      notifiedCount++;
    }
  }

  logger.info({ staleRequests: staleRequests.length, notifiedCount }, "remindStaleRequests job completed");
}
