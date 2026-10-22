import { DateTime } from "luxon";
import { formatPrice } from "@/lib/format";

/** Everything a booking e-mail needs; built by notifications.ts. */
export interface BookingEmailData {
  customerName: string;
  serviceName: string;
  optionName: string;
  employeeName: string;
  startsAt: Date;
  endsAt: Date;
  priceOre: number;
  timezone: string;
  /** Present only while the customer may still cancel online. */
  cancelUrl?: string;
  cancelHoursBefore: number;
  salon: { name: string; addressLine: string; postalCode: string; city: string; phone: string; email: string };
  websiteUrl: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function when(d: BookingEmailData) {
  const s = DateTime.fromJSDate(d.startsAt, { zone: d.timezone }).setLocale("en-GB");
  const e = DateTime.fromJSDate(d.endsAt, { zone: d.timezone });
  return { date: s.toFormat("cccc d LLLL yyyy"), time: `${s.toFormat("HH:mm")}–${e.toFormat("HH:mm")}`, short: s.toFormat("ccc d LLL 'at' HH:mm") };
}

function layout(d: BookingEmailData, heading: string, intro: string, body: string) {
  const e = escapeHtml;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(heading)}</title></head>
<body style="margin:0;background:#faf8f5;font-family:Helvetica,Arial,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3ded6">
<tr><td style="padding:28px 32px 8px;letter-spacing:4px;font-size:18px">${e(d.salon.name.toUpperCase())}</td></tr>
<tr><td style="padding:16px 32px 0"><h1 style="margin:0;font-weight:300;font-size:26px">${e(heading)}</h1>
<p style="margin:12px 0 0;line-height:1.5;color:#6b665f">${intro}</p></td></tr>
<tr><td style="padding:20px 32px">${body}</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid #e3ded6;font-size:13px;line-height:1.6;color:#6b665f">
${e(d.salon.name)} · ${e(d.salon.addressLine)}, ${e(d.salon.postalCode)} ${e(d.salon.city)}<br>
<a href="tel:${e(d.salon.phone.replace(/\s/g, ""))}" style="color:#141414">${e(d.salon.phone)}</a> ·
<a href="mailto:${e(d.salon.email)}" style="color:#141414">${e(d.salon.email)}</a> ·
<a href="${e(d.websiteUrl)}" style="color:#141414">Website</a>
</td></tr></table></td></tr></table></body></html>`;
}

function detailsTable(d: BookingEmailData) {
  const e = escapeHtml;
  const w = when(d);
  const row = (k: string, v: string) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e3ded6;color:#6b665f">${k}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #e3ded6">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3ded6;font-size:15px">
${row("Service", `${e(d.serviceName)} — ${e(d.optionName)}`)}
${row("Date", e(w.date))}
${row("Time", e(w.time))}
${row("With", e(d.employeeName))}
${row("Price", e(formatPrice(d.priceOre)))}
</table>`;
}

function detailsText(d: BookingEmailData) {
  const w = when(d);
  return [
    `Service: ${d.serviceName} — ${d.optionName}`,
    `Date: ${w.date}`,
    `Time: ${w.time}`,
    `With: ${d.employeeName}`,
    `Price: ${formatPrice(d.priceOre)}`,
  ].join("\n");
}

function cancelBlock(d: BookingEmailData) {
  if (d.cancelUrl) {
    return {
      html: `<p style="margin:24px 0 0;line-height:1.5">Can't make it? You can cancel online up to ${d.cancelHoursBefore} hours before your appointment.</p>
<p style="margin:16px 0 0"><a href="${escapeHtml(d.cancelUrl)}" style="display:inline-block;padding:12px 22px;border:1px solid #141414;color:#141414;text-decoration:none">Cancel booking</a></p>`,
      text: `Can't make it? Cancel online up to ${d.cancelHoursBefore} hours before: ${d.cancelUrl}`,
    };
  }
  return {
    html: `<p style="margin:24px 0 0;line-height:1.5">Can't make it? Please call us on ${escapeHtml(d.salon.phone)}.</p>`,
    text: `Can't make it? Please call us on ${d.salon.phone}.`,
  };
}

const footerText = (d: BookingEmailData) => `\n\n${d.salon.name}\n${d.salon.addressLine}, ${d.salon.postalCode} ${d.salon.city}\n${d.salon.phone} · ${d.salon.email}`;

export function confirmationEmail(d: BookingEmailData) {
  const first = d.customerName.split(" ")[0];
  const c = cancelBlock(d);
  return {
    subject: `Booking confirmed: ${when(d).short}`,
    html: layout(d, "Your booking is confirmed", `Hi ${escapeHtml(first)}, thank you for booking with us. Here are the details:`, detailsTable(d) + c.html),
    text: `Hi ${first},\n\nYour booking at ${d.salon.name} is confirmed.\n\n${detailsText(d)}\n\n${c.text}${footerText(d)}`,
  };
}

export function reminderEmail(d: BookingEmailData) {
  const first = d.customerName.split(" ")[0];
  const c = cancelBlock(d);
  return {
    subject: `Reminder: see you tomorrow at ${DateTime.fromJSDate(d.startsAt, { zone: d.timezone }).toFormat("HH:mm")}`,
    html: layout(d, "See you tomorrow", `Hi ${escapeHtml(first)}, a friendly reminder of your appointment:`, detailsTable(d) + c.html),
    text: `Hi ${first},\n\nA friendly reminder of your appointment tomorrow at ${d.salon.name}.\n\n${detailsText(d)}\n\n${c.text}${footerText(d)}`,
  };
}

export function movedEmail(d: BookingEmailData) {
  const first = d.customerName.split(" ")[0];
  const c = cancelBlock(d);
  return {
    subject: `Your booking has been changed: ${when(d).short}`,
    html: layout(d, "Your booking has been changed", `Hi ${escapeHtml(first)}, your appointment has been moved. The new details are:`, detailsTable(d) + c.html),
    text: `Hi ${first},\n\nYour appointment at ${d.salon.name} has been moved. New details:\n\n${detailsText(d)}\n\n${c.text}${footerText(d)}`,
  };
}

export function cancelledEmail(d: BookingEmailData, by: "customer" | "salon") {
  const first = d.customerName.split(" ")[0];
  const intro =
    by === "customer"
      ? `Hi ${escapeHtml(first)}, your booking has been cancelled as requested.`
      : `Hi ${escapeHtml(first)}, unfortunately we have had to cancel your booking. We're sorry for the inconvenience — please book a new time or call us.`;
  const book = `<p style="margin:24px 0 0"><a href="${escapeHtml(d.websiteUrl)}/booking" style="display:inline-block;padding:12px 22px;background:#141414;color:#faf8f5;text-decoration:none">Book a new time</a></p>`;
  return {
    subject: `Booking cancelled: ${when(d).short}`,
    html: layout(d, "Booking cancelled", intro, detailsTable(d) + book),
    text: `${intro.replace(/&#39;/g, "'")}\n\n${detailsText(d)}\n\nBook a new time: ${d.websiteUrl}/booking${footerText(d)}`,
  };
}

/** iCalendar attachment so the customer can add the appointment to their calendar. */
export function bookingIcs(d: BookingEmailData, uid: string, sequence = 0) {
  const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Salon de Choix//Booking//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@salondechoix`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(d.startsAt)}`,
    `DTEND:${fmt(d.endsAt)}`,
    `SUMMARY:${esc(`${d.optionName} — ${d.salon.name}`)}`,
    `LOCATION:${esc(`${d.salon.addressLine}, ${d.salon.postalCode} ${d.salon.city}`)}`,
    `DESCRIPTION:${esc(`${d.serviceName} with ${d.employeeName}. Phone: ${d.salon.phone}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
