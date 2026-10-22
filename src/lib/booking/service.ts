import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient, type Booking } from "@prisma/client";
import {
  addDays,
  availableSlots,
  fitsSchedule,
  isSlotAvailable,
  isWithinBookingWindow,
  localDayInterval,
  MINUTE,
  pickEmployee,
  toLocalDate,
  type BookingRules,
  type EmployeeSchedule,
  type LocalDate,
  type Slot,
} from "@/lib/scheduling";
import { BookingError } from "./errors";

type Db = PrismaClient | Prisma.TransactionClient;

export async function getBookingRules(db: Db): Promise<BookingRules> {
  const s = await db.salonSettings.findUnique({ where: { id: 1 } });
  return {
    timezone: s?.timezone ?? "Europe/Copenhagen",
    slotStepMin: s?.slotStepMin ?? 15,
    minNoticeMin: s?.minNoticeMin ?? 60,
    maxWeeksAhead: s?.maxWeeksAhead ?? 8,
  };
}

async function getActiveOption(db: Db, optionId: string) {
  const option = await db.serviceOption.findFirst({
    where: { id: optionId, active: true, service: { active: true } },
  });
  if (!option) throw new BookingError("OPTION_NOT_FOUND");
  return option;
}

/** Active employees who can perform the option's service, in team order. */
export async function getQualifiedEmployees(db: Db, serviceId: string) {
  return db.employee.findMany({
    where: { active: true, services: { some: { serviceId } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, title: true, photoUrl: true },
  });
}

/**
 * Loads working hours, breaks, blocked time and active bookings for the given
 * employees around one local date and turns them into engine input.
 */
export async function loadSchedules(
  db: Db,
  employeeIds: string[],
  date: LocalDate,
  timezone: string,
  opts: { excludeBookingId?: string; toDate?: LocalDate } = {},
): Promise<{ schedules: EmployeeSchedule[]; bookingCounts: Record<string, number> }> {
  // Loads data for `date` … `opts.toDate` (inclusive); the engine clips per day.
  const dayStart = new Date(localDayInterval(date, timezone).start);
  const dayEnd = new Date(localDayInterval(opts.toDate ?? date, timezone).end);

  const [hours, breaks, blocks, bookings] = await Promise.all([
    db.workingHours.findMany({ where: { employeeId: { in: employeeIds } } }),
    db.break.findMany({ where: { employeeId: { in: employeeIds } } }),
    db.blockedTime.findMany({
      where: {
        OR: [{ employeeId: { in: employeeIds } }, { employeeId: null }],
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    }),
    db.booking.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: "CONFIRMED",
        startsAt: { lt: dayEnd },
        blockedUntil: { gt: dayStart },
        ...(opts.excludeBookingId ? { id: { not: opts.excludeBookingId } } : {}),
      },
      select: { employeeId: true, startsAt: true, blockedUntil: true },
    }),
  ]);

  const bookingCounts: Record<string, number> = {};
  const schedules = employeeIds.map((employeeId) => {
    const own = bookings.filter((b) => b.employeeId === employeeId);
    bookingCounts[employeeId] = own.length;
    return {
      employeeId,
      workingHours: hours.filter((h) => h.employeeId === employeeId),
      breaks: breaks.filter((b) => b.employeeId === employeeId),
      blocked: blocks
        .filter((b) => b.employeeId === null || b.employeeId === employeeId)
        .map((b) => ({ start: b.startsAt.getTime(), end: b.endsAt.getTime() })),
      busy: own.map((b) => ({ start: b.startsAt.getTime(), end: b.blockedUntil.getTime() })),
    };
  });
  return { schedules, bookingCounts };
}

/**
 * Free start times for an option on a date. `employeeId = null` means
 * "No preference": the union over all qualified employees.
 */
export async function getAvailableSlots(
  db: Db,
  input: { optionId: string; employeeId: string | null; date: LocalDate; now?: Date },
): Promise<Slot[]> {
  const option = await getActiveOption(db, input.optionId);
  const rules = await getBookingRules(db);
  const qualified = (await getQualifiedEmployees(db, option.serviceId)).map((e) => e.id);
  const ids = input.employeeId ? qualified.filter((id) => id === input.employeeId) : qualified;
  if (input.employeeId && ids.length === 0) throw new BookingError("EMPLOYEE_NOT_QUALIFIED");

  const { schedules } = await loadSchedules(db, ids, input.date, rules.timezone);
  return availableSlots(
    schedules,
    { date: input.date, durationMin: option.durationMin, bufferMin: option.bufferMin, now: input.now ?? new Date() },
    rules,
  );
}

/**
 * For a date strip: which of `days` consecutive dates starting at `from` have
 * at least one free slot. Loads all data for the range in one go.
 */
export async function getAvailableDays(
  db: Db,
  input: { optionId: string; employeeId: string | null; from: LocalDate; days: number; now?: Date },
): Promise<{ date: LocalDate; available: boolean }[]> {
  const option = await getActiveOption(db, input.optionId);
  const rules = await getBookingRules(db);
  const qualified = (await getQualifiedEmployees(db, option.serviceId)).map((e) => e.id);
  const ids = input.employeeId ? qualified.filter((id) => id === input.employeeId) : qualified;
  if (input.employeeId && ids.length === 0) throw new BookingError("EMPLOYEE_NOT_QUALIFIED");

  const dates = Array.from({ length: input.days }, (_, i) => addDays(input.from, i, rules.timezone));
  const { schedules } = await loadSchedules(db, ids, dates[0], rules.timezone, { toDate: dates[dates.length - 1] });
  const now = input.now ?? new Date();
  return dates.map((date) => ({
    date,
    available:
      availableSlots(schedules, { date, durationMin: option.durationMin, bufferMin: option.bufferMin, now }, rules).length > 0,
  }));
}

export interface CreateBookingInput {
  optionId: string;
  /** null = "No preference" */
  employeeId: string | null;
  startsAt: Date;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  note?: string;
  /**
   * "customer": only offered slots (grid, notice and horizon rules apply).
   * "staff": any minute inside the employee's free time, also last-minute.
   */
  mode?: "customer" | "staff";
  now?: Date;
}

const MAX_ATTEMPTS = 5;

/** Postgres serialization failure or overlap-constraint violation → safe to retry. */
function isRetryableConflict(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") return true;
  const text = e instanceof Error ? e.message : String(e);
  return /40001|could not serialize|23P01|Booking_no_overlap|write conflict|deadlock/i.test(text);
}

/**
 * Creates a booking. Availability is checked again inside a SERIALIZABLE
 * transaction right before insert; together with the database exclusion
 * constraint this guarantees that two customers can never get the same slot.
 * On a conflict the whole check is retried, so a "No preference" booking can
 * still land on another free employee.
 */
export async function createBooking(db: PrismaClient, input: CreateBookingInput): Promise<Booking> {
  const mode = input.mode ?? "customer";
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const now = input.now ?? new Date();
          const option = await getActiveOption(tx, input.optionId);
          const rules = await getBookingRules(tx);
          const start = input.startsAt.getTime();

          if (mode === "customer" && !isWithinBookingWindow(start, now, rules)) {
            throw new BookingError("OUTSIDE_BOOKING_WINDOW");
          }

          const qualified = (await getQualifiedEmployees(tx, option.serviceId)).map((e) => e.id);
          const candidates = input.employeeId ? qualified.filter((id) => id === input.employeeId) : qualified;
          if (input.employeeId && candidates.length === 0) throw new BookingError("EMPLOYEE_NOT_QUALIFIED");

          const date = toLocalDate(start, rules.timezone);
          const { schedules, bookingCounts } = await loadSchedules(tx, candidates, date, rules.timezone);
          const free = schedules.filter((s) =>
            mode === "customer"
              ? isSlotAvailable(s, start, { durationMin: option.durationMin, bufferMin: option.bufferMin, now }, rules)
              : fitsSchedule(s, start, option.durationMin, option.bufferMin, rules.timezone),
          );
          if (free.length === 0) throw new BookingError("SLOT_UNAVAILABLE");

          const employeeId = pickEmployee(
            free.map((s) => s.employeeId),
            bookingCounts,
            qualified,
          );

          return tx.booking.create({
            data: {
              optionId: option.id,
              employeeId,
              customerName: input.customerName,
              customerPhone: input.customerPhone,
              customerEmail: input.customerEmail,
              note: input.note ?? "",
              startsAt: new Date(start),
              endsAt: new Date(start + option.durationMin * MINUTE),
              blockedUntil: new Date(start + (option.durationMin + option.bufferMin) * MINUTE),
              durationMin: option.durationMin,
              bufferMin: option.bufferMin,
              priceOre: option.priceOre,
              source: mode === "staff" ? "ADMIN" : "ONLINE",
              cancelToken: randomBytes(24).toString("base64url"),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 15_000 },
      );
    } catch (e) {
      if (e instanceof BookingError) throw e;
      if (isRetryableConflict(e)) {
        if (attempt >= MAX_ATTEMPTS) throw new BookingError("SLOT_UNAVAILABLE");
        await new Promise((r) => setTimeout(r, 10 + Math.random() * 40 * attempt));
        continue;
      }
      throw e;
    }
  }
}
