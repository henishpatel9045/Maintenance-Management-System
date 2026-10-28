import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  setDay,
  setDate,
  startOfDay,
  isBefore,
  isAfter,
  isSameDay,
  getDay,
  lastDayOfMonth,
} from "date-fns";
import { RecurrenceFrequency, ScheduleMode, OccurrenceStatus, Prisma } from "@prisma/client";
import { db } from "../../core/db";

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  interval: number;
  byWeekday: number[]; // 1 = Monday, ..., 7 = Sunday
  byMonthDay: number[]; // 1..31
  bySetPos?: number | null; // e.g. 1 for first, -1 for last
  startDate: Date;
  endDate?: Date | null;
}

export function describeRecurrenceRule(rule: RecurrenceConfig): string {
  const { frequency, interval, byWeekday, byMonthDay } = rule;
  const intervalPrefix = interval === 1 ? "" : `every ${interval} `;

  const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const selectedDays = (byWeekday || []).map((d) => weekdayNames[d - 1]).filter(Boolean);

  switch (frequency) {
    case RecurrenceFrequency.DAILY:
      return interval === 1 ? "Daily" : `Every ${interval} days`;
    case RecurrenceFrequency.EVERY_N_DAYS:
      return `Every ${interval} days`;
    case RecurrenceFrequency.WEEKLY:
      if (selectedDays.length > 0) {
        return `${intervalPrefix ? `Every ${interval} weeks on ` : "Weekly on "}${selectedDays.join(", ")}`;
      }
      return interval === 1 ? "Weekly" : `Every ${interval} weeks`;
    case RecurrenceFrequency.MONTHLY:
      if (byMonthDay && byMonthDay.length > 0) {
        return `${intervalPrefix ? `Every ${interval} months on day ` : "Monthly on day "}${byMonthDay.join(", ")}`;
      }
      return interval === 1 ? "Monthly" : `Every ${interval} months`;
    case RecurrenceFrequency.QUARTERLY:
      return interval === 1 ? "Quarterly" : `Every ${interval} quarters`;
    case RecurrenceFrequency.YEARLY:
      return interval === 1 ? "Annually" : `Every ${interval} years`;
    default:
      return "Custom recurring schedule";
  }
}

export function calculateOccurrenceDates(
  rule: RecurrenceConfig,
  horizonDays: number = 90,
  referenceDate: Date = new Date()
): Date[] {
  const dates: Date[] = [];
  const start = startOfDay(new Date(rule.startDate));
  const horizonEnd = addDays(startOfDay(referenceDate), horizonDays);
  const endLimit = rule.endDate ? startOfDay(new Date(rule.endDate)) : horizonEnd;
  const effectiveEnd = isBefore(endLimit, horizonEnd) ? endLimit : horizonEnd;

  switch (rule.frequency) {
    case RecurrenceFrequency.DAILY:
    case RecurrenceFrequency.EVERY_N_DAYS: {
      const step = Math.max(1, rule.interval || 1);
      let current = start;
      while (!isAfter(current, effectiveEnd)) {
        if (!isBefore(current, startOfDay(referenceDate))) {
          dates.push(current);
        }
        current = addDays(current, step);
      }
      break;
    }

    case RecurrenceFrequency.WEEKLY: {
      const step = Math.max(1, rule.interval || 1);
      const targetDays = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [1]; // default Mon

      let weekCursor = start;
      while (!isAfter(weekCursor, effectiveEnd)) {
        for (const weekday of targetDays) {
          // Convert 1 (Mon) .. 7 (Sun) to JS getDay 0 (Sun) .. 6 (Sat)
          const jsDay = weekday === 7 ? 0 : weekday;
          const candidate = setDay(weekCursor, jsDay, { weekStartsOn: 1 });
          if (!isBefore(candidate, start) && !isAfter(candidate, effectiveEnd) && !isBefore(candidate, startOfDay(referenceDate))) {
            if (!dates.some((d) => isSameDay(d, candidate))) {
              dates.push(candidate);
            }
          }
        }
        weekCursor = addWeeks(weekCursor, step);
      }
      break;
    }

    case RecurrenceFrequency.MONTHLY: {
      const step = Math.max(1, rule.interval || 1);
      const targetDays = rule.byMonthDay && rule.byMonthDay.length > 0 ? rule.byMonthDay : [start.getDate()];

      let monthCursor = start;
      while (!isAfter(monthCursor, effectiveEnd)) {
        for (const mDay of targetDays) {
          const lastDay = lastDayOfMonth(monthCursor).getDate();
          const effectiveDay = Math.min(mDay, lastDay);
          const candidate = setDate(monthCursor, effectiveDay);

          if (!isBefore(candidate, start) && !isAfter(candidate, effectiveEnd) && !isBefore(candidate, startOfDay(referenceDate))) {
            if (!dates.some((d) => isSameDay(d, candidate))) {
              dates.push(candidate);
            }
          }
        }
        monthCursor = addMonths(monthCursor, step);
      }
      break;
    }

    case RecurrenceFrequency.QUARTERLY: {
      const step = Math.max(1, rule.interval || 1) * 3;
      let monthCursor = start;
      while (!isAfter(monthCursor, effectiveEnd)) {
        if (!isBefore(monthCursor, startOfDay(referenceDate))) {
          dates.push(monthCursor);
        }
        monthCursor = addMonths(monthCursor, step);
      }
      break;
    }

    case RecurrenceFrequency.YEARLY: {
      const step = Math.max(1, rule.interval || 1);
      let yearCursor = start;
      while (!isAfter(yearCursor, effectiveEnd)) {
        if (!isBefore(yearCursor, startOfDay(referenceDate))) {
          dates.push(yearCursor);
        }
        yearCursor = addYears(yearCursor, step);
      }
      break;
    }
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

export function getNextThreeDates(rule: RecurrenceConfig, fromDate: Date = new Date()): Date[] {
  const dates = calculateOccurrenceDates(rule, 365, fromDate);
  return dates.slice(0, 3);
}

export async function generateOccurrencesForSeva(params: {
  sevaId: string;
  horizonDays?: number;
}): Promise<number> {
  const { sevaId, horizonDays = 90 } = params;

  const seva = await db.seva.findUnique({
    where: { id: sevaId },
    include: { recurrenceRule: true, checklistItems: true },
  });

  if (!seva || seva.kind !== "RECURRING" || !seva.recurrenceRule || seva.isArchived) {
    return 0;
  }

  const rule = seva.recurrenceRule;
  const targetDates = calculateOccurrenceDates(
    {
      frequency: rule.frequency,
      interval: rule.interval,
      byWeekday: rule.byWeekday,
      byMonthDay: rule.byMonthDay,
      bySetPos: rule.bySetPos,
      startDate: rule.startDate,
      endDate: rule.endDate,
    },
    horizonDays
  );

  let createdCount = 0;

  for (const date of targetDates) {
    try {
      const occ = await db.occurrence.create({
        data: {
          sevaId,
          dueDate: date,
          status: OccurrenceStatus.PENDING,
        },
      });

      // Copy checklist items to occurrence
      if (seva.checklistItems.length > 0) {
        await db.occurrenceChecklist.createMany({
          data: seva.checklistItems.map((item) => ({
            occurrenceId: occ.id,
            checklistItemId: item.id,
            isCompleted: false,
          })),
        });
      }

      createdCount++;
    } catch (err: any) {
      // Ignore unique constraint violations (idempotent generation)
      if (err.code !== "P2002") {
        throw err;
      }
    }
  }

  return createdCount;
}

export async function handleOccurrenceCompleted(occurrenceId: string): Promise<void> {
  const occ = await db.occurrence.findUnique({
    where: { id: occurrenceId },
    include: {
      seva: {
        include: {
          recurrenceRule: true,
          checklistItems: true,
        },
      },
    },
  });

  if (!occ || occ.seva.kind !== "RECURRING" || !occ.seva.recurrenceRule) {
    return;
  }

  // FLOATING schedule mode: next occurrence is completedAt + interval
  if (occ.seva.scheduleMode === ScheduleMode.FLOATING) {
    const completedAt = occ.completedAt || new Date();
    const rule = occ.seva.recurrenceRule;
    let nextDate: Date;

    switch (rule.frequency) {
      case RecurrenceFrequency.DAILY:
      case RecurrenceFrequency.EVERY_N_DAYS:
        nextDate = addDays(completedAt, rule.interval || 1);
        break;
      case RecurrenceFrequency.WEEKLY:
        nextDate = addWeeks(completedAt, rule.interval || 1);
        break;
      case RecurrenceFrequency.MONTHLY:
        nextDate = addMonths(completedAt, rule.interval || 1);
        break;
      case RecurrenceFrequency.QUARTERLY:
        nextDate = addMonths(completedAt, (rule.interval || 1) * 3);
        break;
      case RecurrenceFrequency.YEARLY:
        nextDate = addYears(completedAt, rule.interval || 1);
        break;
      default:
        nextDate = addDays(completedAt, 7);
    }

    try {
      const newOcc = await db.occurrence.create({
        data: {
          sevaId: occ.sevaId,
          dueDate: nextDate,
          status: OccurrenceStatus.PENDING,
        },
      });

      if (occ.seva.checklistItems.length > 0) {
        await db.occurrenceChecklist.createMany({
          data: occ.seva.checklistItems.map((item) => ({
            occurrenceId: newOcc.id,
            checklistItemId: item.id,
            isCompleted: false,
          })),
        });
      }
    } catch (err: any) {
      if (err.code !== "P2002") throw err;
    }
  }
}
