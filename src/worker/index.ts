import cron from "node-cron";
import { config } from "../core/config";
import { logger } from "../core/logger";
import { withAdvisoryLock } from "./advisoryLock";
import { runNightlyOccurrenceGeneration } from "./jobs/occurrenceGeneration";
import { runHourlyOverdueCheck } from "./jobs/overdueCheck";
import { runDispatchReminders } from "./jobs/dispatchReminders";
import { runOrphanedFileCleanup } from "./jobs/orphanedFileCleanup";
import { runRefreshCredentialStatus } from "./jobs/refreshCredentialStatus";
import { runScheduleCredentialReminders } from "./jobs/scheduleCredentialReminders";
import { runRemindStaleRequests } from "./jobs/remindStaleRequests";
import { runRefreshLicenceStatus } from "./jobs/refreshLicenceStatus";
import { runScheduleLicenceReminders } from "./jobs/scheduleLicenceReminders";
import { runLicenceSnapshot } from "./jobs/licenceSnapshot";
import { runCheckUpcomingSevaLicences } from "./jobs/checkUpcomingSevaLicences";

logger.info({ tz: config.TZ }, "Seva Background Worker Daemon initialized");

// Lock keys (unique 32-bit integers)
const LOCK_OCCURRENCE_GEN = 1001;
const LOCK_OVERDUE_CHECK = 1002;
const LOCK_REMINDERS = 1003;
const LOCK_CLEANUP = 1004;
const LOCK_REFRESH_CREDENTIALS = 2001;
const LOCK_SCHEDULE_CRED_REMINDERS = 2002;
const LOCK_STALE_REQUESTS = 2003;
const LOCK_REFRESH_LICENCES = 3001;
const LOCK_SCHEDULE_LICENCE_REMINDERS = 3002;
const LOCK_LICENCE_SNAPSHOT = 3003;
const LOCK_CHECK_UPCOMING_SEVA_LICENCES = 3004;

// 1. Nightly occurrence generation (02:00 org time)
cron.schedule(
  "0 2 * * *",
  async () => {
    await withAdvisoryLock(LOCK_OCCURRENCE_GEN, "NightlyOccurrenceGeneration", runNightlyOccurrenceGeneration);
  },
  { timezone: config.TZ }
);

// 1b. Daily contractor credential status refresh (02:30 org time)
cron.schedule(
  "30 2 * * *",
  async () => {
    await withAdvisoryLock(LOCK_REFRESH_CREDENTIALS, "RefreshCredentialStatus", runRefreshCredentialStatus);
  },
  { timezone: config.TZ }
);

// 1c. Daily licence status refresh and availability reversion (02:45 org time)
cron.schedule(
  "45 2 * * *",
  async () => {
    await withAdvisoryLock(LOCK_REFRESH_LICENCES, "RefreshLicenceStatus", runRefreshLicenceStatus);
  },
  { timezone: config.TZ }
);

// 1d. Daily contractor credential reminders schedule (03:00 org time)
cron.schedule(
  "0 3 * * *",
  async () => {
    await withAdvisoryLock(LOCK_SCHEDULE_CRED_REMINDERS, "ScheduleCredentialReminders", runScheduleCredentialReminders);
  },
  { timezone: config.TZ }
);

// 1e. Daily licence reminders schedule (03:15 org time)
cron.schedule(
  "15 3 * * *",
  async () => {
    await withAdvisoryLock(LOCK_SCHEDULE_LICENCE_REMINDERS, "ScheduleLicenceReminders", runScheduleLicenceReminders);
  },
  { timezone: config.TZ }
);

// 1f. Daily check of upcoming seva licence requirements (03:45 org time)
cron.schedule(
  "45 3 * * *",
  async () => {
    await withAdvisoryLock(LOCK_CHECK_UPCOMING_SEVA_LICENCES, "CheckUpcomingSevaLicences", runCheckUpcomingSevaLicences);
  },
  { timezone: config.TZ }
);

// 1g. Daily stale contractor requests reminder (09:00 org time)
cron.schedule(
  "0 9 * * *",
  async () => {
    await withAdvisoryLock(LOCK_STALE_REQUESTS, "RemindStaleRequests", runRemindStaleRequests);
  },
  { timezone: config.TZ }
);

// 2. Hourly overdue check
cron.schedule(
  "0 * * * *",
  async () => {
    await withAdvisoryLock(LOCK_OVERDUE_CHECK, "HourlyOverdueCheck", runHourlyOverdueCheck);
  },
  { timezone: config.TZ }
);

// 3. Reminder dispatcher (every 15 minutes)
cron.schedule(
  "*/15 * * * *",
  async () => {
    await withAdvisoryLock(LOCK_REMINDERS, "DispatchReminders", runDispatchReminders);
  },
  { timezone: config.TZ }
);

// 4. Weekly orphaned-file cleanup (Sunday 03:00)
cron.schedule(
  "0 3 * * 0",
  async () => {
    await withAdvisoryLock(LOCK_CLEANUP, "OrphanedFileCleanup", runOrphanedFileCleanup);
  },
  { timezone: config.TZ }
);

// 4b. Weekly licence capacity snapshot (Sunday 03:30)
cron.schedule(
  "30 3 * * 0",
  async () => {
    await withAdvisoryLock(LOCK_LICENCE_SNAPSHOT, "LicenceSnapshot", runLicenceSnapshot);
  },
  { timezone: config.TZ }
);

logger.info("All scheduled worker cron jobs registered and running.");

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("Worker received SIGTERM; gracefully shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Worker received SIGINT; shutting down...");
  process.exit(0);
});
