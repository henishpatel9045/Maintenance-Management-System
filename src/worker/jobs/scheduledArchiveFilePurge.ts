import { executeScheduledFilePurges } from "@/modules/seva/archiveService";
import { logger } from "@/core/logger";

export async function runScheduledArchiveFilePurge(): Promise<void> {
  logger.info("Executing scheduled archive file purge job...");
  try {
    const result = await executeScheduledFilePurges();
    logger.info(
      { purgedEntries: result.purgedEntries, deletedFilesCount: result.deletedFilesCount },
      "Scheduled archive file purge job finished"
    );
  } catch (err) {
    logger.error({ err }, "Error running scheduled archive file purge job");
  }
}
