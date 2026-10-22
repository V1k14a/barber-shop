import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/admin/guard";
import { getBookingRules, getStaffSlots } from "@/lib/booking/service";
import { formatLocalTime } from "@/lib/scheduling";
import { fieldErrors, slotsQuerySchema } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = slotsQuerySchema.extend({ excludeBookingId: z.string().max(64).optional() });

export async function GET(req: NextRequest) {
  if (!(await currentUser())) return jsonError(401, "Not signed in");
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return jsonError(400, "Invalid request", { fields: fieldErrors(parsed.error) });
  try {
    const [slots, rules] = await Promise.all([getStaffSlots(prisma, parsed.data), getBookingRules(prisma)]);
    return NextResponse.json({
      slots: slots.map((s) => ({ time: formatLocalTime(s.start, rules.timezone), employeeIds: s.employeeIds })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
