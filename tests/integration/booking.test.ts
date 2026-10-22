import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import { createBooking, getAvailableSlots } from "@/lib/booking/service";
import { BookingError } from "@/lib/booking/errors";

const db = new PrismaClient();
const TZ = "Europe/Copenhagen";
const DATE = "2026-11-03"; // Tuesday
const NOW = new Date("2026-11-01T08:00:00Z");
const at = (time: string) => new Date(DateTime.fromISO(`${DATE}T${time}`, { zone: TZ }).toMillis());
const fmt = (ms: number) => DateTime.fromMillis(ms, { zone: TZ }).toFormat("HH:mm");

const customer = { customerName: "Test Customer", customerPhone: "+4512345678", customerEmail: "test@example.com" };

async function resetData() {
  await db.booking.deleteMany();
  await db.blockedTime.deleteMany();
  await db.adminUser.deleteMany();
  await db.employee.deleteMany();
  await db.service.deleteMany();
  await db.salonSettings.deleteMany();

  await db.salonSettings.create({
    data: { id: 1, name: "Test", addressLine: "", postalCode: "", city: "", phone: "", email: "", minNoticeMin: 0 },
  });
  await db.service.create({
    data: {
      id: "svc_mani",
      slug: "manicure",
      name: "Manicure",
      options: { create: { id: "opt_mani", name: "Classic", durationMin: 45, priceOre: 37500, bufferMin: 15 } },
    },
  });
  await db.service.create({
    data: { id: "svc_men", slug: "mens", name: "Men's haircut", options: { create: { id: "opt_cut", name: "Haircut", durationMin: 30, priceOre: 35000 } } },
  });
  const tuesday = { weekday: 2, startMin: 9 * 60, endMin: 17 * 60 };
  for (const [i, [id, svc]] of ([["emma", "svc_mani"], ["ida", "svc_mani"], ["mads", "svc_men"]] as const).entries()) {
    await db.employee.create({
      data: { id, name: id, sortOrder: i, services: { create: { serviceId: svc } }, workingHours: { create: tuesday } },
    });
  }
}

const book = (overrides: Partial<Parameters<typeof createBooking>[1]>) =>
  createBooking(db, { optionId: "opt_cut", employeeId: "mads", startsAt: at("10:00"), now: NOW, ...customer, ...overrides });

const codeOf = (r: PromiseSettledResult<unknown>) =>
  r.status === "rejected" ? (r.reason instanceof BookingError ? r.reason.code : String(r.reason)) : "OK";

beforeEach(resetData);
afterAll(() => db.$disconnect());

describe("createBooking", () => {
  it("stores UTC times, buffer end and price snapshot", async () => {
    const b = await book({ optionId: "opt_mani", employeeId: "emma" });
    expect(b.startsAt.toISOString()).toBe("2026-11-03T09:00:00.000Z");
    expect(b.endsAt.toISOString()).toBe("2026-11-03T09:45:00.000Z");
    expect(b.blockedUntil.toISOString()).toBe("2026-11-03T10:00:00.000Z");
    expect(b.priceOre).toBe(37500);
    expect(b.cancelToken.length).toBeGreaterThanOrEqual(32);
  });

  it("removes the booked time (incl. buffer) from the slot list", async () => {
    await book({ optionId: "opt_mani", employeeId: "emma" }); // 10:00–10:45 +15 buffer
    const slots = await getAvailableSlots(db, { optionId: "opt_mani", employeeId: "emma", date: DATE, now: NOW });
    const t = slots.map((s) => fmt(s.start));
    expect(t).toContain("09:00"); // 09:00 + 60 = 10:00 exactly
    expect(t).not.toContain("09:15");
    expect(t).not.toContain("10:45");
    expect(t).toContain("11:00");
  });

  it("rejects an employee who does not offer the service", async () => {
    await expect(book({ employeeId: "emma" })).rejects.toMatchObject({ code: "EMPLOYEE_NOT_QUALIFIED" });
  });

  it("rejects bookings in the past and too far ahead", async () => {
    await expect(book({ now: new Date("2026-11-04T00:00:00Z") })).rejects.toMatchObject({ code: "OUTSIDE_BOOKING_WINDOW" });
    await expect(book({ now: new Date("2026-08-01T00:00:00Z") })).rejects.toMatchObject({ code: "OUTSIDE_BOOKING_WINDOW" });
  });

  it("respects salon-wide closures", async () => {
    await db.blockedTime.create({ data: { employeeId: null, startsAt: at("00:00"), endsAt: at("23:59"), type: "HOLIDAY" } });
    await expect(book({})).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    expect(await getAvailableSlots(db, { optionId: "opt_cut", employeeId: null, date: DATE, now: NOW })).toEqual([]);
  });

  it("customers can only pick offered slots, staff can pick any free minute", async () => {
    await expect(book({ startsAt: at("10:05") })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    const b = await book({ startsAt: at("10:05"), mode: "staff" });
    expect(b.source).toBe("ADMIN");
    await expect(book({ startsAt: at("10:20"), mode: "staff" })).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("a cancelled booking frees the slot again", async () => {
    const b = await book({});
    await db.booking.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
    await expect(book({})).resolves.toBeTruthy();
  });
});

describe('"No preference"', () => {
  it("assigns to the employee with fewest bookings that day", async () => {
    await book({ optionId: "opt_mani", employeeId: "emma", startsAt: at("09:00") });
    const b = await book({ optionId: "opt_mani", employeeId: null, startsAt: at("13:00") });
    expect(b.employeeId).toBe("ida");
  });

  it("falls through to the other employee when the less busy one is taken", async () => {
    await book({ optionId: "opt_mani", employeeId: "emma", startsAt: at("13:00") }); // Emma: 1 booking, busy 13:00
    await book({ optionId: "opt_mani", employeeId: "ida", startsAt: at("09:00") });
    await book({ optionId: "opt_mani", employeeId: "ida", startsAt: at("10:00") }); // Ida: 2 bookings, free 13:00
    const b = await book({ optionId: "opt_mani", employeeId: null, startsAt: at("13:00") });
    expect(b.employeeId).toBe("ida");
  });

  it("keeps showing a slot while at least one employee is free", async () => {
    await book({ optionId: "opt_mani", employeeId: "emma", startsAt: at("10:00") });
    const slots = await getAvailableSlots(db, { optionId: "opt_mani", employeeId: null, date: DATE, now: NOW });
    expect(slots.find((s) => fmt(s.start) === "10:00")?.employeeIds).toEqual(["ida"]);
  });
});

describe("simultaneous requests (no double bookings)", () => {
  it("only one of 10 parallel requests for the same employee and slot succeeds", async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => book({})));
    const codes = results.map(codeOf);
    expect(codes.filter((c) => c === "OK")).toHaveLength(1);
    expect(codes.filter((c) => c === "SLOT_UNAVAILABLE")).toHaveLength(9);
    expect(await db.booking.count({ where: { status: "CONFIRMED" } })).toBe(1);
  });

  it("parallel overlapping (not identical) requests can't both succeed", async () => {
    const results = await Promise.allSettled([book({ startsAt: at("10:00") }), book({ startsAt: at("10:15") })]);
    expect(results.map(codeOf).filter((c) => c === "OK")).toHaveLength(1);
  });

  it('"No preference": 3 parallel requests with 2 free employees → 2 bookings on different employees', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () => book({ optionId: "opt_mani", employeeId: null, startsAt: at("11:00") })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ employeeId: string }>).value);
    expect(ok).toHaveLength(2);
    expect(new Set(ok.map((b) => b.employeeId))).toEqual(new Set(["emma", "ida"]));
    expect(results.map(codeOf).filter((c) => c === "SLOT_UNAVAILABLE")).toHaveLength(1);
  });

  it("the database itself rejects overlapping bookings, even bypassing the service", async () => {
    const b = await book({});
    await expect(
      db.booking.create({
        data: {
          optionId: b.optionId,
          employeeId: b.employeeId,
          ...customer,
          durationMin: 30,
          bufferMin: 0,
          priceOre: 0,
          cancelToken: "other",
          startsAt: at("10:15"),
          endsAt: at("10:45"),
          blockedUntil: at("10:45"),
        },
      }),
    ).rejects.toThrow(/Booking_no_overlap|23P01/);
  });
});
