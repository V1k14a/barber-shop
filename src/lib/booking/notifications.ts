/**
 * Hooks called after booking changes. E-mail sending is wired up in the
 * notifications step; failures here must never fail the booking itself.
 */
export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
  void bookingId;
}
export async function notifyBookingCancelled(bookingId: string, by: "customer" | "salon"): Promise<void> {
  void bookingId;
  void by;
}
export async function notifyBookingMoved(bookingId: string): Promise<void> {
  void bookingId;
}
