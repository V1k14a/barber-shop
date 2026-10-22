import { DateTime } from "luxon";
import { freeIntervalsForDay, type EmployeeSchedule } from "./availability";
import { isContained, MINUTE, type Interval } from "./intervals";
import { localDayInterval, parseLocalDate, toLocalDate, type LocalDate } from "./time";

export interface BookingRules {
  timezone: string;
  /** Spacing of offered start times, aligned to local midnight (15 → :00, :15, :30, :45). */
  slotStepMin: number;
  /** Earliest start = now + minNoticeMin. */
  minNoticeMin: number;
  /** Last bookable local date = today + maxWeeksAhead × 7 days. */
  maxWeeksAhead: number;
}

export interface SlotRequest {
  date: LocalDate;
  durationMin: number;
  bufferMin: number;
  now: Date;
}

export interface Slot {
  /** Start instant, epoch ms (UTC). */
  start: number;
  /** End of the appointment itself (without buffer). */
  end: number;
  /** Employees who are free for the whole duration + buffer at this time. */
  employeeIds: string[];
}

export function lastBookableDate(now: Date, rules: BookingRules): LocalDate {
  return DateTime.fromJSDate(now, { zone: rules.timezone })
    .startOf("day")
    .plus({ days: rules.maxWeeksAhead * 7 })
    .toISODate()!;
}

/** Is `start` inside the allowed booking window (not in the past / too soon / too far ahead)? */
export function isWithinBookingWindow(start: number, now: Date, rules: BookingRules): boolean {
  if (start < now.getTime() + rules.minNoticeMin * MINUTE) return false;
  return toLocalDate(start, rules.timezone) <= lastBookableDate(now, rules);
}

/** Is the local date bookable at all (today … last bookable date)? */
export function isDateInWindow(date: LocalDate, now: Date, rules: BookingRules): boolean {
  parseLocalDate(date, rules.timezone); // validates format
  const today = toLocalDate(now, rules.timezone);
  return date >= today && date <= lastBookableDate(now, rules);
}

/** The time the employee is occupied by a booking starting at `start`. */
export function occupiedInterval(start: number, durationMin: number, bufferMin: number): Interval {
  return { start, end: start + (durationMin + bufferMin) * MINUTE };
}

/** Start times (epoch ms) at which one employee can take the requested option. */
export function slotsForEmployee(schedule: EmployeeSchedule, req: SlotRequest, rules: BookingRules): number[] {
  if (!isDateInWindow(req.date, req.now, rules)) return [];
  const free = freeIntervalsForDay(schedule, req.date, rules.timezone);
  const step = rules.slotStepMin * MINUTE;
  const needed = (req.durationMin + req.bufferMin) * MINUTE;
  const dayStart = localDayInterval(req.date, rules.timezone).start;

  const result: number[] = [];
  for (const f of free) {
    // First grid point at or after the free interval's start.
    let t = dayStart + Math.ceil((f.start - dayStart) / step) * step;
    for (; t + needed <= f.end; t += step) {
      if (isWithinBookingWindow(t, req.now, rules)) result.push(t);
    }
  }
  return result;
}

/**
 * Available slots for a set of employees. With one employee this is that
 * employee's slots; with several ("No preference") it is the union, each slot
 * listing every employee free at that time.
 */
export function availableSlots(schedules: EmployeeSchedule[], req: SlotRequest, rules: BookingRules): Slot[] {
  const byStart = new Map<number, string[]>();
  for (const s of schedules) {
    for (const t of slotsForEmployee(s, req, rules)) {
      const list = byStart.get(t) ?? [];
      list.push(s.employeeId);
      byStart.set(t, list);
    }
  }
  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, employeeIds]) => ({ start, end: start + req.durationMin * MINUTE, employeeIds }));
}

/**
 * Re-check used right before saving: can this employee take a booking at
 * exactly `start`? Same rules as the slot list, so the customer can only
 * book what they were offered.
 */
export function isSlotAvailable(
  schedule: EmployeeSchedule,
  start: number,
  req: Omit<SlotRequest, "date">,
  rules: BookingRules,
): boolean {
  const date = toLocalDate(start, rules.timezone);
  return slotsForEmployee(schedule, { ...req, date }, rules).includes(start);
}

/**
 * Same check without the grid/notice/horizon rules — used by staff adding or
 * moving bookings manually, who may pick any minute (e.g. 10:05) or book
 * last-minute, but still never on top of another booking or outside hours.
 */
export function fitsSchedule(schedule: EmployeeSchedule, start: number, durationMin: number, bufferMin: number, timezone: string): boolean {
  const date = toLocalDate(start, timezone);
  return isContained(occupiedInterval(start, durationMin, bufferMin), freeIntervalsForDay(schedule, date, timezone));
}

/**
 * "No preference": choose which free employee gets the booking.
 * Fewest bookings that day wins (spreads the work); ties go to the
 * employee listed first in `order` (the team's sort order).
 */
export function pickEmployee(candidates: string[], bookingsToday: Record<string, number>, order: string[]): string {
  if (candidates.length === 0) throw new Error("No candidates");
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...candidates].sort((a, b) => (bookingsToday[a] ?? 0) - (bookingsToday[b] ?? 0) || rank(a) - rank(b))[0];
}
