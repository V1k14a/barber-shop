export type BookingErrorCode =
  | "OPTION_NOT_FOUND"
  | "EMPLOYEE_NOT_QUALIFIED"
  | "OUTSIDE_BOOKING_WINDOW"
  | "SLOT_UNAVAILABLE"
  | "BOOKING_NOT_FOUND"
  | "CANCELLATION_TOO_LATE";

const messages: Record<BookingErrorCode, string> = {
  OPTION_NOT_FOUND: "This service is no longer available.",
  EMPLOYEE_NOT_QUALIFIED: "The selected employee does not offer this service.",
  OUTSIDE_BOOKING_WINDOW: "This time can no longer be booked.",
  SLOT_UNAVAILABLE: "Sorry, this time was just taken. Please choose another time.",
  BOOKING_NOT_FOUND: "Booking not found.",
  CANCELLATION_TOO_LATE: "This booking can no longer be cancelled online. Please call the salon.",
};

export class BookingError extends Error {
  constructor(public readonly code: BookingErrorCode, message = messages[code]) {
    super(message);
    this.name = "BookingError";
  }
}
