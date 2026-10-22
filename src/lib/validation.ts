import { z } from "zod";

const id = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid id");
export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** "No preference" is sent as "any" (or omitted) and becomes null. */
const employeeChoice = z
  .union([id, z.literal("any"), z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v && v !== "any" ? v : null));

export const slotsQuerySchema = z.object({
  optionId: id,
  employeeId: employeeChoice,
  date: localDate,
});

export const availabilityQuerySchema = z.object({
  optionId: id,
  employeeId: employeeChoice,
  from: localDate,
  days: z.coerce.number().int().min(1).max(14).default(7),
});

export const customerSchema = z.object({
  customerName: z.string().trim().min(2, "Please enter your name").max(100),
  customerPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{8,15}$/, "Please enter a valid phone number")),
  customerEmail: z.string().trim().toLowerCase().email("Please enter a valid e-mail address").max(200),
  note: z.string().trim().max(500).optional().default(""),
});

export const bookingRequestSchema = customerSchema.extend({
  optionId: id,
  employeeId: employeeChoice,
  startsAt: z.string().datetime({ offset: true }).transform((v) => new Date(v)),
  /** Honeypot field: real users never see or fill it. */
  website: z.string().max(200).optional(),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

/** Flattens zod errors into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
