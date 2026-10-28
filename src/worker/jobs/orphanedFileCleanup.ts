import { db } from "../../core/db";
import { storage } from "../../core/storage/storage";
import { logger } from "../../core/logger";

export async function runOrphanedFileCleanup(): Promise<void> {
  logger.info("Executing weekly orphaned-file cleanup job...");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30); // 30-day grace period for deleted files

  const softDeletedFiles = await db.fileObject.findMany({
    where: {
      deletedAt: { lte: cutoff },
    },
    take: 100,
  });

  let removedCount = 0;
  for (const f of softDeletedFiles) {
    try {
      await storage.deleteFile(f.storageKey);
      if (f.thumbnailKey) {
        await storage.deleteFile(f.thumbnailKey);
      }
      await db.fileObject.delete({ where: { id: f.id } });
      removedCount++;
    } catch (err) {
      logger.error({ err, fileObjectId: f.id }, "Failed cleaning up orphaned file");
    }
  }

  logger.info({ removedCount }, "Weekly orphaned-file cleanup completed");
}
