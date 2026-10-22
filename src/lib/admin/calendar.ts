import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { getBookingRules } from "@/lib/booking/service";
import { localDayInterval, weeklyRulesForDate, type LocalDate } from "@/lib/scheduling";

export type CalendarBooking = {
  id: string;
  employeeId: string;
  start: Date;
  end: Date;
  blockedUntil: Date;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  optionName: string;
  status: string;
  note: string;
};

export type CalendarBlock = { id: string; employeeId: string | null; start: Date; end: Date; type: string; reason: string };

/** Everything needed to draw the calendar for a range of local dates. */
export async function loadCalendar(from: LocalDate, days: number, employeeId?: string) {
  const { timezone } = await getBookingRules(prisma);
  const start = new Date(localDayInterval(from, timezone).start);
  const lastDate = DateTime.fromISO(from, { zone: timezone }).plus({ days: days - 1 }).toISODate()!;
  const end = new Date(localDayInterval(lastDate, timezone).end);

  const employees = await prisma.employee.findMany({
    where: { active: true, ...(employeeId ? { id: employeeId } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { workingHours: true, breaks: true },
  });
  const ids = employees.map((e) => e.id);

  const [bookings, blocks] = await Promise.all([
    prisma.booking.findMany({
      where: { employeeId: { in: ids }, status: { not: "CANCELLED" }, startsAt: { lt: end }, endsAt: { gt: start } },
      include: { option: { include: { service: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.blockedTime.findMany({
      where: { OR: [{ employeeId: { in: ids } }, { employeeId: null }], startsAt: { lt: end }, endsAt: { gt: start } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  return {
    timezone,
    employees,
    bookings: bookings.map<CalendarBooking>((b) => ({
      id: b.id,
      employeeId: b.employeeId,
      start: b.startsAt,
      end: b.endsAt,
      blockedUntil: b.blockedUntil,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      serviceName: b.option.service.name,
      optionName: b.option.name,
      status: b.status,
      note: b.note,
    })),
    blocks: blocks.map<CalendarBlock>((b) => ({ id: b.id, employeeId: b.employeeId, start: b.startsAt, end: b.endsAt, type: b.type, reason: b.reason })),
  };
}

export type CalendarData = Awaited<ReturnType<typeof loadCalendar>>;

/** Working shifts and breaks of one employee on a date, as absolute intervals. */
export function shiftsFor(employee: CalendarData["employees"][number], date: LocalDate, timezone: string) {
  return {
    shifts: weeklyRulesForDate(employee.workingHours, date, timezone),
    breaks: weeklyRulesForDate(employee.breaks, date, timezone),
  };
}
