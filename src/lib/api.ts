import { NextResponse } from "next/server";
import { BookingError, type BookingErrorCode } from "@/lib/booking/errors";

const statusByCode: Record<BookingErrorCode, number> = {
  OPTION_NOT_FOUND: 404,
  EMPLOYEE_NOT_QUALIFIED: 422,
  OUTSIDE_BOOKING_WINDOW: 422,
  SLOT_UNAVAILABLE: 409,
  BOOKING_NOT_FOUND: 404,
  CANCELLATION_TOO_LATE: 422,
};

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

/** Maps known domain errors to HTTP responses; logs and hides everything else. */
export function handleApiError(e: unknown) {
  if (e instanceof BookingError) return jsonError(statusByCode[e.code], e.message, { code: e.code });
  console.error(e);
  return jsonError(500, "Something went wrong. Please try again or call the salon.");
}
