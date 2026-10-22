"use server";

import { after } from "next/server";
import { prisma } from "@/lib/db";
import { cancelBookingByToken } from "@/lib/booking/service";
import { BookingError } from "@/lib/booking/errors";
import { notifyBookingCancelled } from "@/lib/booking/notifications";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

export type CancelState = { done?: boolean; error?: string } | undefined;

export async function cancelByToken(_: CancelState, fd: FormData): Promise<CancelState> {
  if (!rateLimit(`cancel:${clientIp(await headers())}`, 20, 10 * 60_000)) return { error: "Too many attempts. Please try again later." };
  const token = String(fd.get("token") ?? "").slice(0, 100);
  try {
    const booking = await cancelBookingByToken(prisma, token);
    after(() => notifyBookingCancelled(booking.id, "customer"));
    return { done: true };
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
}
