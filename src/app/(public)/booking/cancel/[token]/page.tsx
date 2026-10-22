import type { Metadata } from "next";
import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { canCustomerCancel } from "@/lib/booking/service";
import { formatPrice } from "@/lib/format";
import { getSalonSettings } from "@/lib/salon";
import { CancelForm } from "./CancelForm";

export const metadata: Metadata = { title: "Cancel booking", robots: { index: false, follow: false } };

// Opening this page never cancels anything (mail scanners prefetch links) — the customer must press the button.
export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await getSalonSettings();
  const booking = token.length <= 100
    ? await prisma.booking.findUnique({ where: { cancelToken: token }, include: { option: { include: { service: true } }, employee: true } })
    : null;

  return (
    <div className="mx-auto max-w-xl px-4 pt-10 sm:px-6 md:pt-16">
      <p className="eyebrow">Your booking</p>
      {!booking ? (
        <>
          <h1 className="mt-2 text-3xl font-light">Booking not found</h1>
          <p className="mt-4 text-muted">The link may be incomplete. Please call us on {settings.phone}.</p>
        </>
      ) : (
        <Details booking={booking} settings={settings} />
      )}
    </div>
  );
}

async function Details({
  booking,
  settings,
}: {
  booking: NonNullable<Awaited<ReturnType<typeof prisma.booking.findUnique>>> & { option: { name: string; service: { name: string } }; employee: { name: string } };
  settings: Awaited<ReturnType<typeof getSalonSettings>>;
}) {
  const start = DateTime.fromJSDate(booking.startsAt, { zone: settings.timezone });
  const end = DateTime.fromJSDate(booking.endsAt, { zone: settings.timezone });
  const canCancel = await canCustomerCancel(prisma, booking);

  return (
    <>
      <h1 className="mt-2 text-3xl font-light">{booking.status === "CANCELLED" ? "This booking is cancelled" : "Cancel your booking?"}</h1>
      <dl className="mt-6 divide-y divide-line border-y border-line">
        {[
          ["Service", `${booking.option.service.name} — ${booking.option.name}`],
          ["When", `${start.toFormat("cccc d LLLL yyyy")}, ${start.toFormat("HH:mm")}–${end.toFormat("HH:mm")}`],
          ["With", booking.employee.name],
          ["Price", formatPrice(booking.priceOre)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>

      {booking.status === "CANCELLED" ? (
        <Link href="/booking" className="mt-8 inline-block bg-ink px-8 py-4 text-paper">
          Book a new time
        </Link>
      ) : booking.status !== "CONFIRMED" || booking.startsAt < new Date() ? (
        <p className="mt-8 text-muted">This appointment has already taken place.</p>
      ) : canCancel ? (
        <CancelForm token={booking.cancelToken} />
      ) : (
        <p className="mt-8">
          Online cancellation is possible up to {settings.cancelHoursBefore} hours before the appointment. Please call us on{" "}
          <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="underline underline-offset-4">
            {settings.phone}
          </a>
          .
        </p>
      )}
    </>
  );
}
