import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/admin/guard";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { BlockForm } from "./BlockForm";
import { deleteBlock } from "./actions";

const TYPE: Record<string, string> = { HOLIDAY: "Holiday", SICK: "Sick", PRIVATE: "Private", OTHER: "Other" };

export default async function BlocksPage() {
  const user = await requireUser();
  const settings = await prisma.salonSettings.findUnique({ where: { id: 1 }, select: { timezone: true } });
  const tz = settings?.timezone ?? "Europe/Copenhagen";
  const now = new Date();

  const [employees, blocks] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.blockedTime.findMany({ where: { endsAt: { gt: now } }, orderBy: { startsAt: "asc" }, include: { employee: { select: { name: true } } } }),
  ]);

  // Bookings that collide with a block (should be moved or cancelled).
  const conflicts = await Promise.all(
    blocks.map((b) =>
      prisma.booking.findMany({
        where: { status: "CONFIRMED", startsAt: { lt: b.endsAt }, blockedUntil: { gt: b.startsAt }, ...(b.employeeId ? { employeeId: b.employeeId } : {}) },
        select: { id: true, customerName: true, startsAt: true },
        orderBy: { startsAt: "asc" },
      }),
    ),
  );

  const fmt = (d: Date) => DateTime.fromJSDate(d, { zone: tz });
  const range = (s: Date, e: Date) => {
    const a = fmt(s);
    const b = fmt(e);
    const wholeDays = a.hour === 0 && a.minute === 0 && b.hour === 0 && b.minute === 0;
    if (wholeDays) {
      const last = b.minus({ days: 1 });
      return last.hasSame(a, "day") ? `${a.toFormat("ccc d LLL yyyy")}, whole day` : `${a.toFormat("ccc d LLL")} – ${last.toFormat("ccc d LLL yyyy")}`;
    }
    return a.hasSame(b, "day") ? `${a.toFormat("ccc d LLL yyyy")}, ${a.toFormat("HH:mm")}–${b.toFormat("HH:mm")}` : `${a.toFormat("ccc d LLL HH:mm")} – ${b.toFormat("ccc d LLL HH:mm")}`;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section>
        <h1 className="text-2xl font-light">Block time off</h1>
        <p className="mt-1 text-muted">Blocked time can&apos;t be booked online.</p>
        <div className="card mt-6">
          <BlockForm employees={employees} isOwner={user.role === "OWNER"} ownEmployeeId={user.employeeId} today={DateTime.now().setZone(tz).toISODate()!} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-light">Upcoming blocked time</h2>
        {blocks.length === 0 && <p className="mt-4 text-muted">Nothing blocked.</p>}
        <ul className="mt-4 space-y-3">
          {blocks.map((b, i) => (
            <li key={b.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg">
                    {b.employee?.name ?? "Whole salon"} <span className="text-sm text-muted">· {TYPE[b.type]}</span>
                  </p>
                  <p>{range(b.startsAt, b.endsAt)}</p>
                  {b.reason && <p className="text-sm text-muted">{b.reason}</p>}
                </div>
                {(user.role === "OWNER" || b.employeeId === user.employeeId) && (
                  <ActionForm action={deleteBlock} confirm="Remove this blocked time?">
                    <input type="hidden" name="blockId" value={b.id} />
                    <SubmitButton className="btn btn-quiet" pendingText="Removing…">
                      Remove
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
              {conflicts[i].length > 0 && (
                <div className="mt-3 border border-danger/30 bg-danger/5 p-3 text-sm">
                  <p className="text-danger">
                    {conflicts[i].length} booking{conflicts[i].length > 1 ? "s" : ""} in this period — move or cancel:
                  </p>
                  <ul className="mt-1">
                    {conflicts[i].map((c) => (
                      <li key={c.id}>
                        <Link href={`/admin/bookings/${c.id}`} className="underline underline-offset-4">
                          {fmt(c.startsAt).toFormat("ccc d LLL HH:mm")} — {c.customerName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
