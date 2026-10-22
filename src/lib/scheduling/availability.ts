import { normalize, subtract, type Interval } from "./intervals";
import { localDayInterval, localMinutesToInstant, weekdayOf, type LocalDate } from "./time";

/** A weekly recurring rule in local wall-clock minutes (e.g. 09:00–17:00 every Monday). */
export interface WeeklyRule {
  weekday: number; // 1 = Monday … 7 = Sunday
  startMin: number;
  endMin: number;
}

/** Everything the engine needs to know about one employee around one date. */
export interface EmployeeSchedule {
  employeeId: string;
  workingHours: WeeklyRule[];
  breaks: WeeklyRule[];
  /** One-off blocked periods (holiday, sick, private, salon closed). */
  blocked: Interval[];
  /** Existing active bookings, from start until end of their buffer time. */
  busy: Interval[];
}

export function weeklyRulesForDate(rules: WeeklyRule[], date: LocalDate, timezone: string): Interval[] {
  const weekday = weekdayOf(date, timezone);
  return rules
    .filter((r) => r.weekday === weekday)
    .map((r) => ({
      start: localMinutesToInstant(date, r.startMin, timezone),
      end: localMinutesToInstant(date, r.endMin, timezone),
    }));
}

/**
 * Free time for one employee on one local date:
 * working hours − breaks − blocked time − existing bookings.
 */
export function freeIntervalsForDay(schedule: EmployeeSchedule, date: LocalDate, timezone: string): Interval[] {
  const day = localDayInterval(date, timezone);
  const working = subtract(weeklyRulesForDate(schedule.workingHours, date, timezone), [
    { start: Number.NEGATIVE_INFINITY, end: day.start },
    { start: day.end, end: Number.POSITIVE_INFINITY },
  ]);
  return normalize(
    subtract(working, [
      ...weeklyRulesForDate(schedule.breaks, date, timezone),
      ...schedule.blocked,
      ...schedule.busy,
    ]),
  );
}
