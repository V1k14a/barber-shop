import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/admin/guard";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/ActionForm";
import { SlotPicker } from "@/components/admin/SlotPicker";
import { formatDuration, formatPrice } from "@/lib/format";
import { cancelAdminBooking, moveAdminBooking, setBookingStatus, updateBookingNote } from "../actions";

const STATUS: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: "Confirmed", className: "bg-success/10 text-success" },
  CANCELLED: { label: "Cancelled", className: "bg-danger/10 text-danger" },
  COMPLETED: { label: "Completed", className: "bg-sand text-muted" },
  NO_SHOW: { label: "No-show", className: "bg-danger/10 text-danger" },
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; moved?: string; cancelled?: string }>;
}) {
  await requireUser();
  const [{ id }, flags] = await Promise.all([params, searchParams]);
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { option: { include: { service: { include: { employees: { include: { employee: true } } } } } }, employee: true },
  });
  if (!booking) notFound();

  const settings = await prisma.salonSettings.findUnique({ where: { id: 1 }, select: { timezone: true } });
  const tz = settings?.timezone ?? "Europe/Copenhagen";
  const start = DateTime.fromJSDate(booking.startsAt, { zone: tz });
  const end = DateTime.fromJSDate(booking.endsAt, { zone: tz });
  const isPast = booking.endsAt.getTime() < Date.now();
  const qualified = booking.option.service.employees.map((e) => e.employee).filter((e) => e.active || e.id === booking.employeeId);
  const status = STATUS[booking.status];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/admin/calendar?date=${start.toISODate()}`} className="text-sm underline-offset-4 hover:underline">
        ← {start.toFormat("cccc d LLLL")} in the calendar
      </Link>

      {flags.created && <Banner>Booking created.</Banner>}
      {flags.moved && <Banner>Booking moved.</Banner>}
      {flags.cancelled && <Banner>Booking cancelled.</Banner>}

      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-light">{booking.customerName}</h1>
            <p className="text-muted">
              {booking.option.service.name} — {booking.option.name}
            </p>
          </div>
          <span className={`px-3 py-1 text-sm ${status.className}`}>{status.label}</span>
        </div>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          <Row label="When">
            {start.toFormat("ccc d LLL yyyy")}, {start.toFormat("HH:mm")}–{end.toFormat("HH:mm")}
            {booking.bufferMin > 0 && <span className="text-muted"> (+{booking.bufferMin} min buffer)</span>}
          </Row>
          <Row label="With">{booking.employee.name}</Row>
          <Row label="Duration / price">
            {formatDuration(booking.durationMin)} · {formatPrice(booking.priceOre)}
          </Row>
          <Row label="Phone">
            <a href={`tel:${booking.customerPhone}`} className="underline underline-offset-4">
              {booking.customerPhone}
            </a>
          </Row>
          <Row label="E-mail">
            {booking.customerEmail ? (
              <a href={`mailto:${booking.customerEmail}`} className="underline underline-offset-4">
                {booking.customerEmail}
              </a>
            ) : (
              <span className="text-muted">—</span>
            )}
          </Row>
          <Row label="Booked">
            {booking.source === "ONLINE" ? "Online" : "By staff"}, {DateTime.fromJSDate(booking.createdAt, { zone: tz }).toFormat("d LLL yyyy HH:mm")}
          </Row>
        </dl>

        <ActionForm action={updateBookingNote} className="mt-5">
          <input type="hidden" name="bookingId" value={booking.id} />
          <label htmlFor="note" className="label">
            Note
          </label>
          <div className="flex gap-2">
            <textarea id="note" name="note" rows={2} maxLength={500} defaultValue={booking.note} className="input" />
            <SubmitButton className="btn btn-quiet shrink-0">Save</SubmitButton>
          </div>
        </ActionForm>
      </section>

      {booking.status !== "CANCELLED" && (
        <section className="card">
          <h2 className="text-lg">Status</h2>
          <ActionForm action={setBookingStatus} className="mt-3">
            <input type="hidden" name="bookingId" value={booking.id} />
            <div className="flex flex-wrap gap-2">
              {booking.status === "CONFIRMED" ? (
                <>
                  <button name="status" value="COMPLETED" className="btn btn-quiet" disabled={!isPast}>
                    ✓ Completed
                  </button>
                  <button name="status" value="NO_SHOW" className="btn btn-quiet" disabled={booking.startsAt.getTime() > Date.now()}>
                    No-show
                  </button>
                </>
              ) : (
                <button name="status" value="CONFIRMED" className="btn btn-quiet">
                  Undo: mark as confirmed
                </button>
              )}
            </div>
          </ActionForm>
        </section>
      )}

      {booking.status === "CONFIRMED" && (
        <>
          <section className="card">
            <h2 className="text-lg">Move booking</h2>
            <ActionForm action={moveAdminBooking} className="mt-4 space-y-4">
              <input type="hidden" name="bookingId" value={booking.id} />
              <div>
                <label htmlFor="employeeId" className="label">
                  Employee
                </label>
                <select id="employeeId" name="employeeId" defaultValue={booking.employeeId} className="input">
                  {qualified.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <SlotPicker
                optionId={booking.optionId}
                employeeId={booking.employeeId}
                defaultDate={start.toISODate()!}
                defaultTime={start.toFormat("HH:mm")}
                excludeBookingId={booking.id}
              />
              <FieldError name="time" />
              {booking.customerEmail && (
                <label className="flex min-h-12 items-center gap-3">
                  <input type="checkbox" name="notify" defaultChecked className="h-5 w-5 accent-ink" />
                  E-mail the customer about the new time
                </label>
              )}
              <SubmitButton className="btn btn-primary w-full">Move booking</SubmitButton>
            </ActionForm>
            <p className="mt-2 text-sm text-muted">Free times shown are for the current employee.</p>
          </section>

          <section className="card border-danger/30">
            <h2 className="text-lg">Cancel booking</h2>
            <ActionForm action={cancelAdminBooking} confirm="Cancel this booking?" className="mt-4 space-y-4">
              <input type="hidden" name="bookingId" value={booking.id} />
              {booking.customerEmail && (
                <label className="flex min-h-12 items-center gap-3">
                  <input type="checkbox" name="notify" defaultChecked className="h-5 w-5 accent-ink" />
                  E-mail the customer about the cancellation
                </label>
              )}
              <SubmitButton className="btn btn-danger w-full" pendingText="Cancelling…">
                Cancel booking
              </SubmitButton>
            </ActionForm>
          </section>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="border border-success/30 bg-success/5 px-4 py-3 text-success">
      {children}
    </p>
  );
}
