import { describe, expect, it } from "vitest";
import { bookingIcs, cancelledEmail, confirmationEmail, escapeHtml, reminderEmail, type BookingEmailData } from "../templates";

const data: BookingEmailData = {
  customerName: "Anna <script>alert(1)</script> Hansen",
  serviceName: "Manicure",
  optionName: "Gel polish",
  employeeName: "Emma Nielsen",
  startsAt: new Date("2026-11-03T09:00:00Z"), // 10:00 Copenhagen
  endsAt: new Date("2026-11-03T10:00:00Z"),
  priceOre: 45000,
  timezone: "Europe/Copenhagen",
  cancelUrl: "https://salon.example/booking/cancel/abc",
  cancelHoursBefore: 24,
  salon: { name: "Salon de Choix", addressLine: "Eksempelgade 12", postalCode: "1000", city: "København K", phone: "+45 12 34 56 78", email: "hello@example.dk" },
  websiteUrl: "https://salon.example",
};

describe("booking e-mails", () => {
  it("shows local time, price and the cancel link", () => {
    const m = confirmationEmail(data);
    expect(m.subject).toBe("Booking confirmed: Tue 3 Nov at 10:00");
    expect(m.text).toContain("Time: 10:00–11:00");
    expect(m.text).toContain("450 kr.");
    expect(m.html).toContain('href="https://salon.example/booking/cancel/abc"');
  });

  it("escapes customer-provided text in HTML", () => {
    const m = confirmationEmail(data);
    expect(m.html).not.toContain("<script>");
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  });

  it("tells the customer to call when online cancellation has closed", () => {
    const m = reminderEmail({ ...data, cancelUrl: undefined });
    expect(m.text).toContain("Please call us on +45 12 34 56 78");
    expect(m.html).not.toContain("/booking/cancel/");
  });

  it("words salon and customer cancellations differently", () => {
    expect(cancelledEmail(data, "customer").text).toContain("cancelled as requested");
    expect(cancelledEmail(data, "salon").text).toContain("we have had to cancel");
  });

  it("builds a valid iCalendar event in UTC", () => {
    const ics = bookingIcs(data, "b1");
    expect(ics).toContain("DTSTART:20261103T090000Z");
    expect(ics).toContain("DTEND:20261103T100000Z");
    expect(ics).toContain("LOCATION:Eksempelgade 12\\, 1000 København K");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
