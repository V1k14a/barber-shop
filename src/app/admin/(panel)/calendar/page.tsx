import Link from "next/link";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/admin/guard";
import { loadCalendar, shiftsFor, type CalendarBlock, type CalendarBooking, type CalendarData } from "@/lib/admin/calendar";
import { localDayInterval } from "@/lib/scheduling";
import { prisma } from "@/lib/db";

const PX_PER_MIN = 1.4;
const BLOCK_LABEL: Record<string, string> = { HOLIDAY: "Holiday", SICK: "Sick", PRIVATE: "Private", OTHER: "Blocked" };

type Search = { date?: string; view?: string; employee?: string; denied?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await prisma.salonSettings.findUnique({ where: { id: 1 }, select: { timezone: true } });
  const tz = settings?.timezone ?? "Europe/Copenhagen";

  const today = DateTime.now().setZone(tz).toISODate()!;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") && DateTime.fromISO(params.date!).isValid ? params.date! : today;
  const view = params.view === "week" ? "week" : "day";
  const employeeParam = params.employee ?? "";

  const allEmployees = await prisma.employee.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  const employeeId = allEmployees.some((e) => e.id === employeeParam) ? employeeParam : undefined;

  const dt = DateTime.fromISO(date, { zone: tz });
  const from = view === "week" ? dt.startOf("week").toISODate()! : date;
  const data = await loadCalendar(from, view === "week" ? 7 : 1, employeeId);

  const step = view === "week" ? { weeks: 1 } : { days: 1 };
  const href = (o: Partial<{ date: string; view: string; employee: string }>) => {
    const q = new URLSearchParams({ date, view, ...(employeeId ? { employee: employeeId } : {}), ...o });
    if (!q.get("employee")) q.delete("employee");
    return `/admin/calendar?${q}`;
  };

  return (
    <div>
      {params.denied && <p className="mb-4 border border-danger/30 bg-danger/5 px-4 py-3 text-danger">That page is only available to the owner.</p>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex">
          <Link href={href({ date: dt.minus(step).toISODate()! })} className="btn btn-quiet px-4" aria-label="Previous">
            ←
          </Link>
          <Link href={href({ date: today })} className="btn btn-quiet -ml-px">
            Today
          </Link>
          <Link href={href({ date: dt.plus(step).toISODate()! })} className="btn btn-quiet -ml-px px-4" aria-label="Next">
            →
          </Link>
        </div>
        <form action="/admin/calendar" className="flex">
          <input type="hidden" name="view" value={view} />
          {employeeId && <input type="hidden" name="employee" value={employeeId} />}
          <input type="date" name="date" defaultValue={date} className="input w-auto" aria-label="Go to date" />
          <button type="submit" className="btn btn-quiet -ml-px">
            Go
          </button>
        </form>
        <div className="flex">
          <Link href={href({ view: "day" })} className={`btn ${view === "day" ? "btn-primary" : "btn-quiet"}`}>
            Day
          </Link>
          <Link href={href({ view: "week" })} className={`btn -ml-px ${view === "week" ? "btn-primary" : "btn-quiet"}`}>
            Week
          </Link>
        </div>
        <Link href={`/admin/bookings/new?date=${date}`} className="btn btn-primary ml-auto">
          + New booking
        </Link>
      </div>

      <h1 className="mt-5 text-2xl font-light">
        {view === "day"
          ? dt.toFormat("cccc d LLLL yyyy")
          : `Week ${dt.weekNumber}: ${dt.startOf("week").toFormat("d LLL")} – ${dt.endOf("week").toFormat("d LLL yyyy")}`}
        {date === today && view === "day" && <span className="ml-3 align-middle text-sm text-muted">Today</span>}
      </h1>

      {/* Employee filter */}
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Link href={href({ employee: "" })} className={`btn shrink-0 ${!employeeId ? "btn-primary" : "btn-quiet"}`}>
          Everyone
        </Link>
        {user.employeeId && (
          <Link href={href({ employee: user.employeeId })} className={`btn shrink-0 ${employeeId === user.employeeId ? "btn-primary" : "btn-quiet"}`}>
            Only me
          </Link>
        )}
        {allEmployees
          .filter((e) => e.id !== user.employeeId)
          .map((e) => (
            <Link key={e.id} href={href({ employee: e.id })} className={`btn shrink-0 ${employeeId === e.id ? "btn-primary" : "btn-quiet"}`}>
              {e.name.split(" ")[0]}
            </Link>
          ))}
      </div>

      <div className="mt-6">{view === "day" ? <DayView date={date} data={data} /> : <WeekView from={from} data={data} />}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Day view */

function DayView({ date, data }: { date: string; data: CalendarData }) {
  const tz = data.timezone;
  const day = localDayInterval(date, tz);
  const minOf = (d: Date | number) => Math.round(((typeof d === "number" ? d : d.getTime()) - day.start) / 60_000);

  const columns = data.employees.map((e) => {
    const { shifts, breaks } = shiftsFor(e, date, tz);
    return {
      employee: e,
      shifts,
      breaks,
      bookings: data.bookings.filter((b) => b.employeeId === e.id),
      blocks: data.blocks.filter((b) => b.employeeId === null || b.employeeId === e.id),
    };
  });

  // Visible hours: cover all shifts and bookings, at least 09–17.
  const points = columns.flatMap((c) => [...c.shifts.flatMap((s) => [minOf(s.start), minOf(s.end)]), ...c.bookings.flatMap((b) => [minOf(b.start), minOf(b.blockedUntil)])]);
  const startMin = Math.max(0, Math.floor(Math.min(9 * 60, ...points) / 60) * 60);
  const endMin = Math.min(24 * 60, Math.ceil(Math.max(17 * 60, ...points) / 60) * 60);
  const height = (endMin - startMin) * PX_PER_MIN;
  const top = (m: number) => (Math.max(startMin, Math.min(endMin, m)) - startMin) * PX_PER_MIN;
  const span = (a: number, b: number) => ({ top: top(a), height: Math.max(top(b) - top(a), 0) });
  const nowMin = minOf(Date.now());
  const hours = Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => startMin + i * 60);

  if (columns.length === 0) return <p className="text-muted">No active employees.</p>;

  return (
    <div className="overflow-x-auto border border-line bg-white">
      <div className="flex min-w-fit">
        {/* Time axis */}
        <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-line bg-white">
          <div className="h-12 border-b border-line" />
          <div className="relative" style={{ height }}>
            {hours.map((m) => (
              <span key={m} className="absolute right-2 -translate-y-1/2 text-xs text-muted tabular-nums" style={{ top: top(m) }}>
                {String(m / 60).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>

        {columns.map((c) => (
          <div key={c.employee.id} className="w-44 shrink-0 border-r border-line last:border-r-0 sm:w-auto sm:min-w-44 sm:flex-1">
            <div className="sticky top-0 flex h-12 items-center justify-center border-b border-line px-2 text-center text-sm">{c.employee.name}</div>
            <div className="relative" style={{ height, background: "repeating-linear-gradient(135deg, var(--color-sand) 0 6px, #f6f3ee 6px 12px)" }}>
              {/* Working time = white */}
              {c.shifts.map((s, i) => (
                <div key={i} className="absolute inset-x-0 bg-white" style={span(minOf(s.start), minOf(s.end))} />
              ))}
              {/* Hour lines */}
              {hours.map((m) => (
                <div key={m} className="absolute inset-x-0 border-t border-line/70" style={{ top: top(m) }} />
              ))}
              {c.breaks.map((b, i) => (
                <div key={i} className="absolute inset-x-0 flex items-center justify-center bg-sand text-xs text-muted" style={span(minOf(b.start), minOf(b.end))}>
                  Break
                </div>
              ))}
              {c.blocks.map((b) => (
                <BlockBox key={b.id} block={b} style={span(minOf(b.start), minOf(b.end))} />
              ))}
              {c.bookings.map((b) => (
                <BookingBox key={b.id} booking={b} tz={tz} style={span(minOf(b.start), minOf(b.end))} bufferStyle={span(minOf(b.end), minOf(b.blockedUntil))} />
              ))}
              {nowMin > startMin && nowMin < endMin && (
                <div className="absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: top(nowMin) }} aria-label="Now" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingBox({ booking: b, tz, style, bufferStyle }: { booking: CalendarBooking; tz: string; style: React.CSSProperties; bufferStyle: React.CSSProperties }) {
  const t = (d: Date) => DateTime.fromJSDate(d, { zone: tz }).toFormat("HH:mm");
  const muted = b.status === "NO_SHOW" || b.status === "COMPLETED";
  return (
    <>
      <Link
        href={`/admin/bookings/${b.id}`}
        className={`absolute inset-x-1 z-[5] overflow-hidden border-l-4 px-2 py-1 text-xs leading-tight shadow-sm hover:z-10 hover:shadow ${
          muted ? "border-muted bg-sand text-muted" : "border-ink bg-[#ecebe7]"
        }`}
        style={style}
      >
        <span className="block font-medium tabular-nums">
          {t(b.start)}–{t(b.end)}
        </span>
        <span className="block truncate">{b.customerName}</span>
        <span className="block truncate text-muted">{b.optionName}</span>
        {b.status === "NO_SHOW" && <span className="block text-danger">No-show</span>}
      </Link>
      {Number(bufferStyle.height) > 0 && <div className="absolute inset-x-1 z-[4] bg-line/60" style={bufferStyle} title="Buffer" />}
    </>
  );
}

function BlockBox({ block, style }: { block: CalendarBlock; style: React.CSSProperties }) {
  return (
    <Link
      href="/admin/blocks"
      className="absolute inset-x-0 z-[3] flex items-start justify-center overflow-hidden px-2 pt-1 text-center text-xs text-muted"
      style={{ ...style, background: "repeating-linear-gradient(45deg, #ece7df 0 8px, #e3ded6 8px 16px)" }}
    >
      {BLOCK_LABEL[block.type]}
      {block.employeeId === null && " · salon closed"}
      {block.reason && ` · ${block.reason}`}
    </Link>
  );
}

/* --------------------------------------------------------------- Week view */

function WeekView({ from, data }: { from: string; data: CalendarData }) {
  const tz = data.timezone;
  const names = Object.fromEntries(data.employees.map((e) => [e.id, e.name]));
  const days = Array.from({ length: 7 }, (_, i) => DateTime.fromISO(from, { zone: tz }).plus({ days: i }));
  const t = (d: Date) => DateTime.fromJSDate(d, { zone: tz }).toFormat("HH:mm");
  const today = DateTime.now().setZone(tz).toISODate();

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {days.map((d) => {
        const iso = d.toISODate()!;
        const day = localDayInterval(iso, tz);
        const inDay = (s: Date, e: Date) => s.getTime() < day.end && e.getTime() > day.start;
        const bookings = data.bookings.filter((b) => inDay(b.start, b.end));
        const blocks = data.blocks.filter((b) => inDay(b.start, b.end));
        return (
          <section key={iso} className={`card ${iso === today ? "border-ink" : ""}`}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg">{d.toFormat("cccc d LLL")}</h2>
              <Link href={`/admin/calendar?date=${iso}&view=day`} className="text-sm underline-offset-4 hover:underline">
                Open day →
              </Link>
            </div>
            <p className="text-sm text-muted">{bookings.length === 0 ? "No bookings" : `${bookings.length} booking${bookings.length > 1 ? "s" : ""}`}</p>
            <ul className="mt-3 divide-y divide-line">
              {blocks.map((b) => (
                <li key={b.id} className="py-2 text-sm text-muted">
                  ⦸ {b.employeeId ? names[b.employeeId] : "Salon closed"} — {BLOCK_LABEL[b.type]}
                  {b.reason && `: ${b.reason}`}
                </li>
              ))}
              {bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex gap-3 py-2.5 hover:bg-paper">
                    <span className="w-12 shrink-0 tabular-nums">{t(b.start)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{b.customerName}</span>
                      <span className="block truncate text-sm text-muted">
                        {b.optionName} · {names[b.employeeId]?.split(" ")[0]}
                        {b.status === "NO_SHOW" && " · No-show"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
