import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAvailableDays } from "@/lib/booking/service";
import { availabilityQuerySchema, fieldErrors } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const parsed = availabilityQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return jsonError(400, "Invalid request", { fields: fieldErrors(parsed.error) });
  try {
    return NextResponse.json({ days: await getAvailableDays(prisma, parsed.data) });
  } catch (e) {
    return handleApiError(e);
  }
}
