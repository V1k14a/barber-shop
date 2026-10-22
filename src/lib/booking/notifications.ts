/**
 * Hooks called after booking changes. E-mail sending is added in the
 * notifications step; failures here must never fail the booking itself.
 */
export async function onBookingCreated(bookingId: string): Promise<void> {
  void bookingId;
}
