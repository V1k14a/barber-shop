"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/admin/guard";
import { checkbox, formToObject, hhmm, hhmmToMinutes, invalid, type ActionState } from "@/lib/admin/action";
import { getBookingRules } from "@/lib/booking/service";
import { addDays, localMinutesToInstant } from "@/lib/scheduling";
import { localDate } from "@/lib/validation";

const schema = z
  .object({
    employeeId: z.string().max(64),
    type: z.enum(["HOLIDAY", "SICK", "PRIVATE", "OTHER"]),
    allDay: checkbox,
    fromDate: localDate,
    toDate: localDate,
    fromTime: z.union([hhmm, z.literal("")]).default(""),
    toTime: z.union([hhmm, z.literal("")]).default(""),
    reason: z.string().trim().max(200),
  })
  .superRefine((v, ctx) => {
    if (!v.allDay && !v.fromTime) ctx.addIssue({ code: "custom", path: ["fromTime"], message: "Enter a start time" });
    if (!v.allDay && !v.toTime) ctx.addIssue({ code: "custom", path: ["toTime"], message: "Enter an end time" });
  });

export async function createBlock(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  // Staff may only block their own time; the owner may block anyone or the whole salon ("").
  const employeeId = v.employeeId || null;
  if (user.role !== "OWNER" && employeeId !== user.employeeId) return { error: "You can only block your own time." };

  const { timezone } = await getBookingRules(prisma);
  const startsAt = new Date(localMinutesToInstant(v.fromDate, v.allDay ? 0 : hhmmToMinutes(v.fromTime), timezone));
  const endsAt = v.allDay
    ? new Date(localMinutesToInstant(addDays(v.toDate, 1, timezone), 0, timezone))
    : new Date(localMinutesToInstant(v.toDate, hhmmToMinutes(v.toTime), timezone));
  if (endsAt <= startsAt) return { error: "The end must be after the start.", fields: { toDate: "Must be after the start" } };

  await prisma.blockedTime.create({ data: { employeeId, type: v.type, reason: v.reason, startsAt, endsAt } });

  const affected = await prisma.booking.count({
    where: {
      status: "CONFIRMED",
      startsAt: { lt: endsAt },
      blockedUntil: { gt: startsAt },
      ...(employeeId ? { employeeId } : {}),
    },
  });
  revalidatePath("/admin/blocks");
  revalidatePath("/admin/calendar");
  return {
    ok:
      affected > 0
        ? `Time blocked. Note: ${affected} existing booking${affected > 1 ? "s fall" : " falls"} in this period — see the list below and move or cancel ${affected > 1 ? "them" : "it"}.`
        : "Time blocked.",
  };
}

export async function deleteBlock(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(fd.get("blockId") ?? "");
  const block = await prisma.blockedTime.findUnique({ where: { id } });
  if (!block) return { error: "Already removed." };
  if (user.role !== "OWNER" && block.employeeId !== user.employeeId) return { error: "You can only remove your own blocked time." };
  await prisma.blockedTime.delete({ where: { id } });
  revalidatePath("/admin/blocks");
  revalidatePath("/admin/calendar");
  return { ok: "Removed." };
}
