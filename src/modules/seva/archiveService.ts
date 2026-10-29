import { db } from "@/core/db";
import { storage } from "@/core/storage/storage";
import { logger } from "@/core/logger";
import { logAudit } from "@/core/audit/audit";
import { archiveSevaSubtree, unarchiveSevaSubtree } from "./hierarchy";

export interface ScheduledPurgeEntry {
  id: string;
  sevaIds: string[];
  scheduledPurgeAt: string; // ISO timestamp (now + 24 hours)
  requestedById: string;
  requestedAt: string; // ISO timestamp
  fileCount: number;
}

const PURGE_QUEUE_SETTING_KEY = "archive_files_purge_queue";

/**
 * Schedule all active files of the given Seva IDs to be purged in 24 hours.
 */
export async function scheduleArchiveFilePurge(params: {
  sevaIds: string[];
  requestedById: string;
}): Promise<{ purgeAt: Date; fileCount: number }> {
  const { sevaIds, requestedById } = params;

  // 1. Calculate 24-hour purge time
  const purgeAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 2. Count active files for these sevas
  const fileCount = await db.sevaFile.count({
    where: {
      sevaId: { in: sevaIds },
      deletedAt: null,
    },
  });

  // 3. Read existing purge queue from settings
  const existingSetting = await db.setting.findUnique({
    where: { key: PURGE_QUEUE_SETTING_KEY },
  });

  let queue: ScheduledPurgeEntry[] = [];
  if (existingSetting?.value && Array.isArray(existingSetting.value)) {
    queue = existingSetting.value as unknown as ScheduledPurgeEntry[];
  }

  // 4. Append new purge entry
  const newEntry: ScheduledPurgeEntry = {
    id: crypto.randomUUID(),
    sevaIds,
    scheduledPurgeAt: purgeAt.toISOString(),
    requestedById,
    requestedAt: new Date().toISOString(),
    fileCount,
  };

  queue.push(newEntry);

  // 5. Save back to Setting
  await db.setting.upsert({
    where: { key: PURGE_QUEUE_SETTING_KEY },
    create: {
      key: PURGE_QUEUE_SETTING_KEY,
      value: queue as any,
    },
    update: {
      value: queue as any,
    },
  });

  logger.info(
    { sevaCount: sevaIds.length, fileCount, purgeAt: purgeAt.toISOString() },
    "Scheduled archive file purge in 24 hours"
  );

  return { purgeAt, fileCount };
}

/**
 * Execute pending purge entries whose scheduledPurgeAt time has elapsed.
 */
export async function executeScheduledFilePurges(): Promise<{
  purgedEntries: number;
  deletedFilesCount: number;
}> {
  const existingSetting = await db.setting.findUnique({
    where: { key: PURGE_QUEUE_SETTING_KEY },
  });

  if (!existingSetting?.value || !Array.isArray(existingSetting.value)) {
    return { purgedEntries: 0, deletedFilesCount: 0 };
  }

  const queue = existingSetting.value as unknown as ScheduledPurgeEntry[];
  const now = new Date();

  const dueEntries = queue.filter((item) => new Date(item.scheduledPurgeAt) <= now);
  const remainingEntries = queue.filter((item) => new Date(item.scheduledPurgeAt) > now);

  if (dueEntries.length === 0) {
    return { purgedEntries: 0, deletedFilesCount: 0 };
  }

  let totalDeletedFiles = 0;

  for (const entry of dueEntries) {
    logger.info(
      { entryId: entry.id, sevaCount: entry.sevaIds.length },
      "Executing scheduled 24-hour archive file purge"
    );

    // Retrieve all files for these sevas
    const files = await db.sevaFile.findMany({
      where: { sevaId: { in: entry.sevaIds } },
      include: { fileObject: true },
    });

    for (const f of files) {
      if (f.fileObject?.storageKey) {
        await storage.deleteFile(f.fileObject.storageKey).catch(() => {});
        totalDeletedFiles++;
      }
      if (f.fileObject?.thumbnailKey) {
        await storage.deleteFile(f.fileObject.thumbnailKey).catch(() => {});
      }
    }

    // Delete sevaFile DB links and unreferenced FileObjects
    const fileObjectIds = files.map((f) => f.fileObjectId);
    await db.sevaFile.deleteMany({
      where: { sevaId: { in: entry.sevaIds } },
    });

    for (const foId of fileObjectIds) {
      const remainingRef = await db.sevaFile.count({ where: { fileObjectId: foId } });
      if (remainingRef === 0) {
        await db.fileObject.delete({ where: { id: foId } }).catch(() => {});
      }
    }

    await logAudit({
      entityType: "SEVA",
      entityId: entry.sevaIds[0] || "bulk",
      action: "ARCHIVE_FILES_PURGED",
      userId: entry.requestedById,
      newValue: {
        entry,
        purgedFilesCount: files.length,
      },
    }).catch(() => {});
  }

  // Update setting with remaining entries
  await db.setting.update({
    where: { key: PURGE_QUEUE_SETTING_KEY },
    data: { value: remainingEntries as any },
  });

  logger.info(
    { purgedEntries: dueEntries.length, deletedFiles: totalDeletedFiles },
    "Completed scheduled archive file purge"
  );

  return {
    purgedEntries: dueEntries.length,
    deletedFilesCount: totalDeletedFiles,
  };
}

/**
 * Bulk archive Sevas, optionally scheduling file deletion in 24 hours.
 */
export async function bulkArchiveSevas(params: {
  sevaIds: string[];
  userId: string;
  scheduleFilePurge?: boolean;
}): Promise<{
  archivedCount: number;
  purgeScheduled: boolean;
  purgeAt?: Date;
  fileCount?: number;
}> {
  const { sevaIds, userId, scheduleFilePurge } = params;

  let archivedCount = 0;
  for (const id of sevaIds) {
    try {
      const res = await archiveSevaSubtree({
        sevaId: id,
        userId,
        archiveSubtree: true,
      });
      archivedCount += res.count;
    } catch (e) {
      logger.error({ err: e, sevaId: id }, "Failed to archive subtree in bulkArchive");
    }
  }

  let purgeResult: { purgeAt: Date; fileCount: number } | undefined;
  if (scheduleFilePurge) {
    purgeResult = await scheduleArchiveFilePurge({ sevaIds, requestedById: userId });
  }

  await logAudit({
    entityType: "SEVA",
    entityId: sevaIds[0] || "bulk",
    action: "SEVA_BULK_ARCHIVED",
    userId,
    newValue: {
      sevaIds,
      archivedCount,
      scheduleFilePurge: Boolean(scheduleFilePurge),
      purgeAt: purgeResult?.purgeAt?.toISOString(),
      fileCount: purgeResult?.fileCount,
    },
  }).catch(() => {});

  return {
    archivedCount,
    purgeScheduled: Boolean(scheduleFilePurge),
    purgeAt: purgeResult?.purgeAt,
    fileCount: purgeResult?.fileCount,
  };
}

/**
 * Bulk unarchive Sevas.
 */
export async function bulkUnarchiveSevas(params: {
  sevaIds: string[];
  userId: string;
}): Promise<{ unarchivedCount: number }> {
  const { sevaIds, userId } = params;

  let unarchivedCount = 0;
  for (const id of sevaIds) {
    try {
      const res = await unarchiveSevaSubtree({
        sevaId: id,
        userId,
        unarchiveSubtree: true,
      });
      unarchivedCount += res.count;
    } catch (e) {
      logger.error({ err: e, sevaId: id }, "Failed to unarchive subtree in bulkUnarchive");
    }
  }

  await logAudit({
    entityType: "SEVA",
    entityId: sevaIds[0] || "bulk",
    action: "SEVA_BULK_UNARCHIVED",
    userId,
    newValue: { sevaIds, unarchivedCount },
  }).catch(() => {});

  return { unarchivedCount };
}

/**
 * Bulk delete Sevas permanently.
 */
export async function bulkDeleteSevas(params: {
  sevaIds: string[];
  userId: string;
}): Promise<{ deletedCount: number }> {
  const { sevaIds, userId } = params;

  // Find all child sevas as well to delete properly
  const rootSevas = await db.seva.findMany({
    where: { id: { in: sevaIds } },
    select: { id: true, path: true },
  });

  const pathConditions = rootSevas.map((s) => ({ path: { startsWith: s.path } }));
  const allSevas = await db.seva.findMany({
    where: {
      OR: [{ id: { in: sevaIds } }, ...pathConditions],
    },
    select: { id: true },
    orderBy: { depth: "desc" }, // Delete children first
  });

  const allIds = allSevas.map((s) => s.id);

  // Delete attached physical files from storage
  const files = await db.sevaFile.findMany({
    where: { sevaId: { in: allIds } },
    include: { fileObject: true },
  });

  for (const f of files) {
    if (f.fileObject?.storageKey) {
      await storage.deleteFile(f.fileObject.storageKey).catch(() => {});
    }
    if (f.fileObject?.thumbnailKey) {
      await storage.deleteFile(f.fileObject.thumbnailKey).catch(() => {});
    }
  }

  // Delete DB records (Prisma cascades on Seva handles assignees, occurrences, files, tags)
  const result = await db.seva.deleteMany({
    where: { id: { in: allIds } },
  });

  await logAudit({
    entityType: "SEVA",
    entityId: sevaIds[0] || "bulk",
    action: "SEVA_BULK_DELETED",
    userId,
    newValue: { requestedIds: sevaIds, totalDeleted: result.count },
  }).catch(() => {});

  return { deletedCount: result.count };
}
