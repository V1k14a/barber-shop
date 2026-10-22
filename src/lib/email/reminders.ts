import type { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import { bookingEmailData } from "@/lib/booking/notifications";
import { reminderEmail } from "@/lib/email/templates";
import { sendMail, type SendMail } from "@/lib/email/transport";
import { localDayInterval } from "@/lib/scheduling";

/** Local hour from which "day before" reminders go out (default 10:00). */
const REMINDER_HOUR = Number(process.env.REMINDER_HOUR ?? 10);

/**
 * Sends reminder e-mails for tomorrow's confirmed bookings. Safe to run as
 * often as you like (e.g. hourly): each booking is claimed atomically via
 * `reminderSentAt` before sending, so nobody gets two reminders. Bookings
 * made less than 24 hours ahead are skipped — they just got a confirmation.
 */
export async function sendDueReminders(db: PrismaClient, now = new Date(), send: SendMail = sendMail) {
  const settings = await db.salonSettings.findUniqueOrThrow({ where: { id: 1 } });
  const local = DateTime.fromJSDate(now, { zone: settings.timezone });
  if (local.hour < REMINDER_HOUR) return { sent: 0, skipped: "too early" };

  const tomorrow = localDayInterval(local.plus({ days: 1 }).toISODate()!, settings.timezone);
  const due = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      customerEmail: { not: "" },
      startsAt: { gte: new Date(tomorrow.start), lt: new Date(tomorrow.end) },
    },
    select: { id: true, startsAt: true, createdAt: true },
  });

  let sent = 0;
  for (const b of due) {
    if (b.startsAt.getTime() - b.createdAt.getTime() < 24 * 3600_000) continue;
    const claimed = await db.booking.updateMany({ where: { id: b.id, reminderSentAt: null, status: "CONFIRMED" }, data: { reminderSentAt: now } });
    if (claimed.count === 0) continue; // another run got it
    try {
      const loaded = await bookingEmailData(db, b.id, now);
      if (!loaded) continue;
      await send({ to: loaded.booking.customerEmail, ...reminderEmail(loaded.data) });
      sent++;
    } catch (e) {
      console.error(`[email] reminder ${b.id} failed, will retry next run:`, e);
      await db.booking.update({ where: { id: b.id }, data: { reminderSentAt: null } });
    }
  }
  return { sent };
}
