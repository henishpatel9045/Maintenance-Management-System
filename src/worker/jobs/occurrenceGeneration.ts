import { db } from "../../core/db";
import { generateOccurrencesForSeva } from "../../modules/seva/recurrence";
import { logger } from "../../core/logger";

export async function runNightlyOccurrenceGeneration(): Promise<void> {
  logger.info("Starting nightly occurrence generation job...");

  const recurringSevas = await db.seva.findMany({
    where: {
      kind: "RECURRING",
      isArchived: false,
      isGroup: false,
    },
    select: { id: true, code: true },
  });

  let totalCreated = 0;
  for (const s of recurringSevas) {
    try {
      const created = await generateOccurrencesForSeva({ sevaId: s.id, horizonDays: 90 });
      totalCreated += created;
    } catch (err) {
      logger.error({ err, sevaId: s.id, code: s.code }, "Failed generating occurrences for recurring seva");
    }
  }

  logger.info({ totalRecurringSevas: recurringSevas.length, totalCreated }, "Nightly occurrence generation completed");
}
