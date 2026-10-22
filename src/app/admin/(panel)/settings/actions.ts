"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/admin/guard";
import { formToObject, invalid, type ActionState } from "@/lib/admin/action";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).default(""),
  addressLine: z.string().trim().min(2, "Required").max(120),
  postalCode: z.string().trim().min(1, "Required").max(20),
  city: z.string().trim().min(1, "Required").max(80),
  phone: z.string().trim().min(6, "Required").max(40),
  email: z.string().trim().email("Enter a valid e-mail"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  openingHours: z
    .string()
    .max(2000)
    .transform((text) =>
      text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [days, ...rest] = l.split("|");
          return { days: days.trim(), hours: rest.join("|").trim() };
        }),
    ),
  slotStepMin: z.coerce.number().int().refine((v) => [5, 10, 15, 20, 30, 60].includes(v), "Choose 5, 10, 15, 20, 30 or 60"),
  maxWeeksAhead: z.coerce.number().int().min(1).max(52),
  cancelHoursBefore: z.coerce.number().int().min(0).max(168),
  minNoticeMin: z.coerce.number().int().min(0).max(7 * 24 * 60),
});

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner();
  const parsed = schema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  await prisma.salonSettings.update({ where: { id: 1 }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}
