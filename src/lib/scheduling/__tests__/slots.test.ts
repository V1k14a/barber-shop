import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import type { EmployeeSchedule, WeeklyRule } from "../availability";
import { MINUTE } from "../intervals";
import {
  availableSlots,
  fitsSchedule,
  isSlotAvailable,
  lastBookableDate,
  pickEmployee,
  slotsForEmployee,
  type BookingRules,
} from "../slots";

const TZ = "Europe/Copenhagen";
const rules: BookingRules = { timezone: TZ, slotStepMin: 15, minNoticeMin: 0, maxWeeksAhead: 8 };

// 2026-11-03 is a Tuesday (CET, UTC+1).
const DATE = "2026-11-03";
const TUESDAY = 2;
const NOW = new Date("2026-11-01T08:00:00Z");

/** Local wall-clock time on a date → epoch ms. */
const at = (time: string, date = DATE) => DateTime.fromISO(`${date}T${time}`, { zone: TZ }).toMillis();
const hm = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const rule = (start: string, end: string, weekday = TUESDAY): WeeklyRule => ({ weekday, startMin: hm(start), endMin: hm(end) });
const fmt = (ms: number) => DateTime.fromMillis(ms, { zone: TZ }).toFormat("HH:mm");

function schedule(overrides: Partial<EmployeeSchedule> = {}): EmployeeSchedule {
  return {
    employeeId: "e1",
    workingHours: [rule("09:00", "17:00")],
    breaks: [],
    blocked: [],
    busy: [],
    ...overrides,
  };
}

function times(s: EmployeeSchedule, durationMin: number, bufferMin = 0, opts: { date?: string; now?: Date; rules?: BookingRules } = {}) {
  return slotsForEmployee(s, { date: opts.date ?? DATE, durationMin, bufferMin, now: opts.now ?? NOW }, opts.rules ?? rules).map(fmt);
}

describe("basic slot generation", () => {
  it("offers every 15 minutes from opening while the full duration fits", () => {
    const t = times(schedule({ workingHours: [rule("09:00", "10:00")] }), 30);
    expect(t).toEqual(["09:00", "09:15", "09:30"]);
  });

  it("returns nothing on a weekday without working hours", () => {
    expect(times(schedule({ workingHours: [rule("09:00", "17:00", 1)] }), 30)).toEqual([]);
  });

  it("supports split shifts", () => {
    const t = times(schedule({ workingHours: [rule("09:00", "10:00"), rule("15:00", "16:00")] }), 60);
    expect(t).toEqual(["09:00", "15:00"]);
  });

  it("aligns start times to the slot grid when hours start off-grid", () => {
    const t = times(schedule({ workingHours: [rule("09:10", "10:00")] }), 30);
    expect(t).toEqual(["09:15", "09:30"]);
  });

  it("returns slots as UTC instants (CET = UTC+1 in November)", () => {
    const [first] = slotsForEmployee(schedule(), { date: DATE, durationMin: 30, bufferMin: 0, now: NOW }, rules);
    expect(new Date(first).toISOString()).toBe("2026-11-03T08:00:00.000Z");
  });
});

describe("closing time", () => {
  it("allows an appointment that ends exactly at closing time", () => {
    const t = times(schedule(), 60);
    expect(t.at(-1)).toBe("16:00");
  });

  it("does not allow an appointment that would run past closing", () => {
    expect(times(schedule(), 60)).not.toContain("16:15");
  });

  it("requires the buffer to fit before closing too", () => {
    // 60 min + 10 min buffer: 16:00 would end at 17:10 → last start is 15:45.
    expect(times(schedule(), 60, 10).at(-1)).toBe("15:45");
  });

  it("returns nothing when the option is longer than the working day", () => {
    expect(times(schedule({ workingHours: [rule("09:00", "10:00")] }), 75)).toEqual([]);
  });
});

describe("breaks", () => {
  it("skips the break and anything that would overlap it", () => {
    const t = times(schedule({ breaks: [rule("12:00", "12:30")] }), 30);
    expect(t).toContain("11:30");
    expect(t).not.toContain("11:45");
    expect(t).not.toContain("12:00");
    expect(t).not.toContain("12:15");
    expect(t).toContain("12:30");
  });
});

describe("existing bookings / overlaps", () => {
  const busy = [{ start: at("10:00"), end: at("10:30") }];

  it("allows back-to-back appointments on either side", () => {
    const t = times(schedule({ busy }), 30);
    expect(t).toContain("09:30"); // ends 10:00 exactly
    expect(t).toContain("10:30"); // starts when the other ends
  });

  it("never offers a slot that overlaps an existing booking", () => {
    const t = times(schedule({ busy }), 30);
    expect(t).not.toContain("09:45");
    expect(t).not.toContain("10:00");
    expect(t).not.toContain("10:15");
  });

  it("rejects a long option that would run into a later booking", () => {
    const t = times(schedule({ busy }), 90);
    expect(t.filter((x) => x < "10:30")).toEqual([]); // 09:00 + 90 min = 10:30 overlaps
    expect(t[0]).toBe("10:30");
  });

  it("respects an existing booking's buffer time", () => {
    // Booking 10:00–10:30 plus 10 min buffer → busy until 10:40, next grid slot 10:45.
    const t = times(schedule({ busy: [{ start: at("10:00"), end: at("10:40") }] }), 30);
    expect(t).not.toContain("10:30");
    expect(t).toContain("10:45");
  });

  it("requires the new booking's buffer to finish before the next booking", () => {
    // New option 30 min + 15 min buffer; next booking at 11:00 → latest start 10:15.
    const t = times(schedule({ busy: [{ start: at("11:00"), end: at("12:00") }] }), 30, 15);
    expect(t).toContain("10:15");
    expect(t).not.toContain("10:30");
  });
});

describe("blocked time", () => {
  it("returns nothing on a fully blocked day (holiday / sick)", () => {
    const blocked = [{ start: at("00:00"), end: at("00:00", "2026-11-04") }];
    expect(times(schedule({ blocked }), 30)).toEqual([]);
  });

  it("handles multi-day blocks that started earlier", () => {
    const blocked = [{ start: at("00:00", "2026-11-01"), end: at("00:00", "2026-11-08") }];
    expect(times(schedule({ blocked }), 30)).toEqual([]);
  });

  it("only removes the blocked part of a day (private appointment)", () => {
    const blocked = [{ start: at("13:00"), end: at("17:00") }];
    const t = times(schedule({ blocked }), 60);
    expect(t.at(-1)).toBe("12:00");
  });
});

describe("booking window", () => {
  it("never offers times in the past", () => {
    const now = new Date(at("10:07"));
    const t = times(schedule(), 30, 0, { now });
    expect(t[0]).toBe("10:15");
  });

  it("applies minimum notice", () => {
    const now = new Date(at("10:07"));
    const t = times(schedule(), 30, 0, { now, rules: { ...rules, minNoticeMin: 60 } });
    expect(t[0]).toBe("11:15");
  });

  it("returns nothing for a date in the past", () => {
    expect(times(schedule(), 30, 0, { now: new Date(at("09:00", "2026-11-04")) })).toEqual([]);
  });

  it("allows the last day of the window but not the day after", () => {
    const last = lastBookableDate(NOW, rules); // 2026-11-01 + 56 days
    expect(last).toBe("2026-12-27");
    const s = schedule({ workingHours: [rule("09:00", "10:00", 7)] }); // 2026-12-27 is a Sunday
    expect(times(s, 30, 0, { date: last })).toHaveLength(3);
    const s2 = schedule({ workingHours: [rule("09:00", "10:00", 1)] }); // 2026-12-28 is a Monday
    expect(times(s2, 30, 0, { date: "2026-12-28" })).toEqual([]);
  });

  it("rejects malformed dates", () => {
    expect(() => times(schedule(), 30, 0, { date: "03-11-2026" })).toThrow();
  });
});

describe("daylight saving time", () => {
  it("keeps local times correct on the autumn change day (25-hour day)", () => {
    // 2026-10-25: clocks go back 03:00 → 02:00. Working 09:00–10:00 local = 08:00–09:00 UTC (CET).
    const s = schedule({ workingHours: [rule("09:00", "10:00", 7)] });
    const slots = slotsForEmployee(s, { date: "2026-10-25", durationMin: 30, bufferMin: 0, now: new Date("2026-10-20T00:00:00Z") }, rules);
    expect(slots.map(fmt)).toEqual(["09:00", "09:15", "09:30"]);
    expect(new Date(slots[0]).toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });

  it("keeps local times correct on the spring change day (23-hour day)", () => {
    // 2027-03-28: clocks go forward 02:00 → 03:00. 09:00 local = 07:00 UTC (CEST).
    const s = schedule({ workingHours: [rule("09:00", "10:00", 7)] });
    const slots = slotsForEmployee(s, { date: "2027-03-28", durationMin: 30, bufferMin: 0, now: new Date("2027-03-20T00:00:00Z") }, rules);
    expect(slots.map(fmt)).toEqual(["09:00", "09:15", "09:30"]);
    expect(new Date(slots[0]).toISOString()).toBe("2027-03-28T07:00:00.000Z");
  });
});

describe('"No preference" (several employees)', () => {
  const a = schedule({ employeeId: "a", workingHours: [rule("09:00", "10:00")] });
  const b = schedule({ employeeId: "b", workingHours: [rule("09:30", "11:00")], busy: [{ start: at("10:00"), end: at("10:30") }] });

  it("returns the union of free slots, listing who is free at each time", () => {
    const slots = availableSlots([a, b], { date: DATE, durationMin: 30, bufferMin: 0, now: NOW }, rules);
    expect(slots.map((s) => [fmt(s.start), s.employeeIds])).toEqual([
      ["09:00", ["a"]],
      ["09:15", ["a"]],
      ["09:30", ["a", "b"]],
      ["10:30", ["b"]],
    ]);
  });

  it("reports the appointment end without buffer", () => {
    const [slot] = availableSlots([a], { date: DATE, durationMin: 30, bufferMin: 10, now: NOW }, rules);
    expect(slot.end - slot.start).toBe(30 * MINUTE);
  });

  it("returns an empty list when nobody is free", () => {
    const blocked = [{ start: at("00:00"), end: at("23:59") }];
    expect(availableSlots([{ ...a, blocked }, { ...b, blocked }], { date: DATE, durationMin: 30, bufferMin: 0, now: NOW }, rules)).toEqual([]);
  });

  it("assigns the employee with the fewest bookings that day", () => {
    expect(pickEmployee(["a", "b"], { a: 3, b: 1 }, ["a", "b"])).toBe("b");
  });

  it("breaks ties by team order", () => {
    expect(pickEmployee(["b", "a"], { a: 2, b: 2 }, ["a", "b"])).toBe("a");
    expect(pickEmployee(["b", "a"], {}, ["a", "b"])).toBe("a");
  });

  it("only picks among the employees free at that slot", () => {
    expect(pickEmployee(["b"], { a: 0, b: 5 }, ["a", "b"])).toBe("b");
    expect(() => pickEmployee([], {}, [])).toThrow();
  });
});

describe("re-check before saving", () => {
  const req = { durationMin: 30, bufferMin: 0, now: NOW };

  it("accepts an offered slot", () => {
    expect(isSlotAvailable(schedule(), at("10:00"), req, rules)).toBe(true);
  });

  it("rejects a slot that was taken in the meantime (second of two simultaneous requests)", () => {
    const first = schedule();
    expect(isSlotAvailable(first, at("10:00"), req, rules)).toBe(true);
    const afterFirstSaved = schedule({ busy: [{ start: at("10:00"), end: at("10:30") }] });
    expect(isSlotAvailable(afterFirstSaved, at("10:00"), req, rules)).toBe(false);
    expect(isSlotAvailable(afterFirstSaved, at("10:15"), req, rules)).toBe(false);
  });

  it("rejects off-grid, past or out-of-hours times", () => {
    expect(isSlotAvailable(schedule(), at("10:05"), req, rules)).toBe(false);
    expect(isSlotAvailable(schedule(), at("08:45"), req, rules)).toBe(false);
    expect(isSlotAvailable(schedule(), at("10:00"), { ...req, now: new Date(at("11:00")) }, rules)).toBe(false);
  });

  it("lets staff book off-grid times manually, but never on top of another booking", () => {
    const s = schedule({ busy: [{ start: at("11:00"), end: at("11:30") }] });
    expect(fitsSchedule(s, at("10:05"), 30, 0, TZ)).toBe(true);
    expect(fitsSchedule(s, at("10:45"), 30, 0, TZ)).toBe(false);
    expect(fitsSchedule(s, at("16:45"), 30, 0, TZ)).toBe(false);
  });
});
