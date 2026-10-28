import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { describeRecurrenceRule, calculateOccurrenceDates } from "./recurrence";
import { RecurrenceFrequency } from "@prisma/client";

describe("Recurrence Engine Property Tests", () => {
  it("never produces dates outside the requested horizon window or before reference date", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }), // interval
        fc.integer({ min: 1, max: 180 }), // horizonDays
        fc.subarray([1, 2, 3, 4, 5, 6, 7], { minLength: 1 }), // byWeekday
        (interval, horizon, weekdays) => {
          const startDate = new Date(2026, 0, 1);
          const refDate = new Date(2026, 0, 1);

          const dates = calculateOccurrenceDates(
            {
              frequency: RecurrenceFrequency.WEEKLY,
              interval,
              byWeekday: weekdays,
              byMonthDay: [],
              startDate,
            },
            horizon,
            refDate
          );

          for (const d of dates) {
            expect(d.getTime()).toBeGreaterThanOrEqual(refDate.getTime());
            const maxDate = new Date(refDate);
            maxDate.setDate(maxDate.getDate() + horizon + 7);
            expect(d.getTime()).toBeLessThanOrEqual(maxDate.getTime());
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it("produces strictly sorted ascending dates with no duplicate dates", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 14 }), // interval
        fc.integer({ min: 7, max: 60 }), // horizon
        (interval, horizon) => {
          const startDate = new Date(2026, 2, 1);
          const dates = calculateOccurrenceDates(
            {
              frequency: RecurrenceFrequency.DAILY,
              interval,
              byWeekday: [],
              byMonthDay: [],
              startDate,
            },
            horizon,
            startDate
          );

          for (let i = 0; i < dates.length - 1; i++) {
            const current = dates[i]!.getTime();
            const next = dates[i + 1]!.getTime();
            expect(next).toBeGreaterThan(current);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it("correctly formats plain language description without throwing", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          RecurrenceFrequency.DAILY,
          RecurrenceFrequency.WEEKLY,
          RecurrenceFrequency.MONTHLY,
          RecurrenceFrequency.QUARTERLY,
          RecurrenceFrequency.YEARLY,
          RecurrenceFrequency.EVERY_N_DAYS
        ),
        fc.integer({ min: 1, max: 10 }),
        (freq, interval) => {
          const desc = describeRecurrenceRule({
            frequency: freq,
            interval,
            byWeekday: [1],
            byMonthDay: [15],
            startDate: new Date(),
          });
          expect(typeof desc).toBe("string");
          expect(desc.length).toBeGreaterThan(0);
        }
      )
    );
  });
});
