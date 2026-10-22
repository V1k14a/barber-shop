import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAvailableSlots, getBookingRules } from "@/lib/booking/service";
import { formatLocalTime } from "@/lib/scheduling";
import { fieldErrors, slotsQuerySchema } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const parsed = slotsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return jsonError(400, "Invalid request", { fields: fieldErrors(parsed.error) });
  try {
    const [slots, rules] = await Promise.all([getAvailableSlots(prisma, parsed.data), getBookingRules(prisma)]);
    return NextResponse.json({
      slots: slots.map((s) => ({ start: new Date(s.start).toISOString(), time: formatLocalTime(s.start, rules.timezone) })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
