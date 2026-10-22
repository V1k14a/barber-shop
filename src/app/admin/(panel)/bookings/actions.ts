"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/admin/guard";
import { checkbox, formToObject, hhmm, hhmmToMinutes, invalid, toActionError, type ActionState } from "@/lib/admin/action";
import { cancelBooking, createBooking, getBookingRules, moveBooking } from "@/lib/booking/service";
import { notifyBookingCancelled, notifyBookingConfirmed, notifyBookingMoved } from "@/lib/booking/notifications";
import { localMinutesToInstant } from "@/lib/scheduling";
import { customerSchema, localDate } from "@/lib/validation";

const id = z.string().min(1).max(64);

const newBookingSchema = customerSchema
  .extend({
    // E-mail is optional for bookings taken over the phone.
    customerEmail: z.union([z.literal(""), customerSchema.shape.customerEmail]),
    optionId: id,
    employeeId: z.string().max(64).transform((v) => (v && v !== "any" ? v : null)),
    date: localDate,
    time: hhmm,
    sendEmail: checkbox,
  });

export async function createAdminBooking(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = newBookingSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { date, time, sendEmail, ...input } = parsed.data;
  const { timezone } = await getBookingRules(prisma);

  let bookingId: string;
  try {
    const booking = await createBooking(prisma, {
      ...input,
      startsAt: new Date(localMinutesToInstant(date, hhmmToMinutes(time), timezone)),
      mode: "staff",
    });
    bookingId = booking.id;
  } catch (e) {
    return toActionError(e);
  }
  if (sendEmail && input.customerEmail) await notifyBookingConfirmed(bookingId);
  revalidatePath("/admin/calendar");
  redirect(`/admin/bookings/${bookingId}?created=1`);
}

const moveSchema = z.object({ bookingId: id, employeeId: id, date: localDate, time: hhmm, notify: checkbox });

export async function moveAdminBooking(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = moveSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { bookingId, employeeId, date, time, notify } = parsed.data;
  const { timezone } = await getBookingRules(prisma);
  try {
    await moveBooking(prisma, { bookingId, employeeId, startsAt: new Date(localMinutesToInstant(date, hhmmToMinutes(time), timezone)) });
  } catch (e) {
    return toActionError(e);
  }
  if (notify) await notifyBookingMoved(bookingId);
  revalidatePath("/admin/calendar");
  redirect(`/admin/bookings/${bookingId}?moved=1`);
}

export async function cancelAdminBooking(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({ bookingId: id, notify: checkbox }).safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  try {
    await cancelBooking(prisma, parsed.data.bookingId);
  } catch (e) {
    return toActionError(e);
  }
  if (parsed.data.notify) await notifyBookingCancelled(parsed.data.bookingId, "salon");
  revalidatePath("/admin/calendar");
  redirect(`/admin/bookings/${parsed.data.bookingId}?cancelled=1`);
}

export async function setBookingStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({ bookingId: id, status: z.enum(["COMPLETED", "NO_SHOW", "CONFIRMED"]) }).safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { bookingId, status } = parsed.data;
  // Only past/finished appointments can be marked; re-confirming is only allowed from COMPLETED/NO_SHOW (not from CANCELLED).
  let res;
  try {
    res = await prisma.booking.updateMany({
      where: { id: bookingId, status: { in: status === "CONFIRMED" ? ["COMPLETED", "NO_SHOW"] : ["CONFIRMED", "COMPLETED", "NO_SHOW"] } },
      data: { status },
    });
  } catch {
    return { error: "Another booking now occupies this time, so it can't be re-activated." };
  }
  if (res.count === 0) return { error: "This booking can't be changed." };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: "Saved." };
}

export async function updateBookingNote(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({ bookingId: id, note: z.string().trim().max(500) }).safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  await prisma.booking.update({ where: { id: parsed.data.bookingId }, data: { note: parsed.data.note } });
  revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
  return { ok: "Note saved." };
}
