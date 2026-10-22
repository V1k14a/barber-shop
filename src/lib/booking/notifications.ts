import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canCustomerCancel } from "@/lib/booking/service";
import { appUrl, sendMail, type SendMail } from "@/lib/email/transport";
import {
  bookingIcs,
  cancelledEmail,
  confirmationEmail,
  movedEmail,
  type BookingEmailData,
} from "@/lib/email/templates";

/** Loads a booking and turns it into template data. Null if it has no e-mail address. */
export async function bookingEmailData(db: PrismaClient, bookingId: string, now = new Date()) {
  const [booking, settings] = await Promise.all([
    db.booking.findUnique({ where: { id: bookingId }, include: { option: { include: { service: true } }, employee: true } }),
    db.salonSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  if (!booking || !booking.customerEmail) return null;
  const data: BookingEmailData = {
    customerName: booking.customerName,
    serviceName: booking.option.service.name,
    optionName: booking.option.name,
    employeeName: booking.employee.name,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    priceOre: booking.priceOre,
    timezone: settings.timezone,
    cancelUrl: (await canCustomerCancel(db, booking, now)) ? appUrl(`/booking/cancel/${booking.cancelToken}`) : undefined,
    cancelHoursBefore: settings.cancelHoursBefore,
    salon: settings,
    websiteUrl: appUrl(),
  };
  return { booking, data };
}

/**
 * E-mail failures are logged, never thrown: a booking must not fail because
 * the mail server is down.
 */
async function safely(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[email] ${label} failed:`, e);
  }
}

export async function notifyBookingConfirmed(bookingId: string, send: SendMail = sendMail): Promise<void> {
  await safely(`confirmation ${bookingId}`, async () => {
    const loaded = await bookingEmailData(prisma, bookingId);
    if (!loaded) return;
    const mail = confirmationEmail(loaded.data);
    await send({
      to: loaded.booking.customerEmail,
      ...mail,
      attachments: [{ filename: "appointment.ics", content: bookingIcs(loaded.data, loaded.booking.id), contentType: "text/calendar; charset=utf-8" }],
    });
  });
}

export async function notifyBookingMoved(bookingId: string, send: SendMail = sendMail): Promise<void> {
  await safely(`moved ${bookingId}`, async () => {
    const loaded = await bookingEmailData(prisma, bookingId);
    if (!loaded) return;
    await send({
      to: loaded.booking.customerEmail,
      ...movedEmail(loaded.data),
      attachments: [
        {
          filename: "appointment.ics",
          content: bookingIcs(loaded.data, loaded.booking.id, Math.floor(loaded.booking.updatedAt.getTime() / 1000)),
          contentType: "text/calendar; charset=utf-8",
        },
      ],
    });
  });
}

export async function notifyBookingCancelled(bookingId: string, by: "customer" | "salon", send: SendMail = sendMail): Promise<void> {
  await safely(`cancelled ${bookingId}`, async () => {
    const loaded = await bookingEmailData(prisma, bookingId);
    if (!loaded) return;
    await send({ to: loaded.booking.customerEmail, ...cancelledEmail(loaded.data, by) });
  });
}

