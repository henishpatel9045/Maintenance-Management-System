import { db } from "../core/db";
import { logger } from "../core/logger";

export async function withAdvisoryLock(
  lockKey: number,
  taskName: string,
  fn: () => Promise<void>
): Promise<boolean> {
  const result = await db.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${lockKey}) as acquired
  `;

  const acquired = result[0]?.acquired ?? false;
  if (!acquired) {
    logger.debug({ taskName, lockKey }, "Advisory lock already held by another worker instance; skipping");
    return false;
  }

  logger.info({ taskName, lockKey }, "Acquired advisory lock; executing scheduled job");

  try {
    await fn();
    return true;
  } catch (err) {
    logger.error({ err, taskName }, "Error executing scheduled worker job");
    throw err;
  } finally {
    await db.$queryRaw`SELECT pg_advisory_unlock(${lockKey})`;
    logger.debug({ taskName, lockKey }, "Released advisory lock");
  }
}
