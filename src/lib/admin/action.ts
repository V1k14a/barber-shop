import { z } from "zod";
import { BookingError } from "@/lib/booking/errors";
import { fieldErrors } from "@/lib/validation";

/** Result returned by admin server actions to <ActionForm>. */
export type ActionState = { ok?: string; error?: string; fields?: Record<string, string> } | undefined;

/** FormData → plain object (checkbox groups with the same name become arrays). */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = fd.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    out[key] = key.endsWith("[]") ? all : all[0];
  }
  return out;
}

export function invalid(error: z.ZodError): ActionState {
  return { error: "Please check the highlighted fields.", fields: fieldErrors(error) };
}

/** Turns known errors into a message for the form; rethrows the rest (incl. redirects). */
export function toActionError(e: unknown): ActionState {
  if (e instanceof BookingError) return { error: e.message };
  if (e instanceof Error && /Unique constraint/i.test(e.message)) return { error: "This value is already in use." };
  if (e instanceof Error && /Foreign key constraint|violates RESTRICT/i.test(e.message)) {
    return { error: "This item is still used by existing bookings. Deactivate it instead." };
  }
  throw e;
}

/** "350" or "350,50" kr → øre */
export const krToOre = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, "").replace(",", "."))
  .pipe(z.coerce.number().min(0).max(100_000))
  .transform((kr) => Math.round(kr * 100));

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
  .transform((v) => v === "on" || v === "true");

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export function hhmmToMinutes(v: string) {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(min: number) {
  if (min >= 1440) return "24:00";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
