import { DateTime } from "luxon";
import type { Interval } from "./intervals";

/** A calendar date in the salon's local time zone, formatted YYYY-MM-DD. */
export type LocalDate = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseLocalDate(date: LocalDate, timezone: string): DateTime {
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date}`);
  const dt = DateTime.fromISO(date, { zone: timezone });
  if (!dt.isValid) throw new Error(`Invalid date: ${date}`);
  return dt.startOf("day");
}

/** ISO weekday of a local date: 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: LocalDate, timezone: string): number {
  return parseLocalDate(date, timezone).weekday;
}

/**
 * Converts "minutes since local midnight" on a given local date to an epoch-ms
 * instant. Uses wall-clock construction (not elapsed-time addition) so that
 * 09:00 is 09:00 on daylight-saving change days too. 1440 = next midnight.
 */
export function localMinutesToInstant(date: LocalDate, minutes: number, timezone: string): number {
  const day = parseLocalDate(date, timezone);
  if (minutes >= 1440) return day.plus({ days: 1 }).toMillis();
  return day.set({ hour: Math.floor(minutes / 60), minute: minutes % 60 }).toMillis();
}

/** The full local day as an absolute interval (23, 24 or 25 hours long). */
export function localDayInterval(date: LocalDate, timezone: string): Interval {
  const day = parseLocalDate(date, timezone);
  return { start: day.toMillis(), end: day.plus({ days: 1 }).toMillis() };
}

export function toLocalDate(instant: number | Date, timezone: string): LocalDate {
  const ms = instant instanceof Date ? instant.getTime() : instant;
  return DateTime.fromMillis(ms, { zone: timezone }).toISODate()!;
}

export function addDays(date: LocalDate, days: number, timezone: string): LocalDate {
  return parseLocalDate(date, timezone).plus({ days }).toISODate()!;
}

export function formatLocalTime(instant: number | Date, timezone: string): string {
  const ms = instant instanceof Date ? instant.getTime() : instant;
  return DateTime.fromMillis(ms, { zone: timezone }).toFormat("HH:mm");
}
