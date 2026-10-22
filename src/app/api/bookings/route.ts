import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createBooking } from "@/lib/booking/service";
import { onBookingCreated } from "@/lib/booking/notifications";
import { bookingRequestSchema, fieldErrors } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!rateLimit(`booking:${clientIp(req.headers)}`, 10, 10 * 60_000)) {
    return jsonError(429, "Too many booking attempts. Please wait a few minutes or call the salon.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid request");
  }
  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", { fields: fieldErrors(parsed.error) });

  const { website, ...input } = parsed.data;
  if (website) return jsonError(400, "Invalid request"); // honeypot filled → bot
  try {
    const booking = await createBooking(prisma, { ...input, mode: "customer" });
    await onBookingCreated(booking.id);
    const employee = await prisma.employee.findUnique({ where: { id: booking.employeeId }, select: { name: true } });
    return NextResponse.json(
      {
        booking: {
          id: booking.id,
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
          employeeName: employee?.name ?? "",
          priceOre: booking.priceOre,
          cancelToken: booking.cancelToken,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
