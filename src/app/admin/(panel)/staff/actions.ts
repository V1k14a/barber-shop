"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/admin/guard";
import { checkbox, formToObject, hhmm, hhmmToMinutes, invalid, toActionError, type ActionState } from "@/lib/admin/action";

const id = z.string().min(1).max(64);

function refresh(employeeId?: string) {
  revalidatePath("/admin/staff");
  if (employeeId) revalidatePath(`/admin/staff/${employeeId}`);
  revalidatePath("/", "layout");
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  title: z.string().trim().max(80).default(""),
  bio: z.string().trim().max(600).default(""),
  photoUrl: z.union([z.literal(""), z.string().trim().url("Enter a full URL (https://…) or leave empty").max(500)]),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: checkbox,
  "serviceIds[]": z.array(id).default([]),
});

export async function createEmployee(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner();
  const parsed = z.object({ name: profileSchema.shape.name }).safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const count = await prisma.employee.count();
  const e = await prisma.employee.create({ data: { name: parsed.data.name, sortOrder: count } });
  refresh();
  redirect(`/admin/staff/${e.id}?new=1`);
}

export async function updateEmployee(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner();
  const employeeId = id.parse(fd.get("employeeId"));
  const parsed = profileSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { "serviceIds[]": serviceIds, photoUrl, ...data } = parsed.data;
  await prisma.$transaction([
    prisma.employee.update({ where: { id: employeeId }, data: { ...data, photoUrl: photoUrl || null } }),
    prisma.employeeService.deleteMany({ where: { employeeId, serviceId: { notIn: serviceIds } } }),
    ...serviceIds.map((serviceId) =>
      prisma.employeeService.upsert({
        where: { employeeId_serviceId: { employeeId, serviceId } },
        update: {},
        create: { employeeId, serviceId },
      }),
    ),
  ]);
  refresh(employeeId);
  return { ok: "Saved." };
}

const range = z.object({ start: hhmm, end: z.union([hhmm, z.literal("24:00")]) });
const scheduleSchema = z.array(
  z.object({ weekday: z.number().int().min(1).max(7), shifts: z.array(range).max(4), breaks: z.array(range).max(4) }),
);

export async function saveSchedule(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner();
  const employeeId = id.parse(fd.get("employeeId"));
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("schedule") ?? "[]"));
  } catch {
    return { error: "Invalid schedule." };
  }
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return { error: "Please fill in all times as HH:MM." };

  const toRows = (kind: "shifts" | "breaks") =>
    parsed.data.flatMap((d) =>
      d[kind].map((r) => ({ employeeId, weekday: d.weekday, startMin: hhmmToMinutes(r.start), endMin: r.end === "24:00" ? 1440 : hhmmToMinutes(r.end) })),
    );
  const shifts = toRows("shifts");
  const breaks = toRows("breaks");
  const bad = [...shifts, ...breaks].find((r) => r.endMin <= r.startMin);
  if (bad) return { error: "Each end time must be after its start time." };

  await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: { employeeId } }),
    prisma.break.deleteMany({ where: { employeeId } }),
    prisma.workingHours.createMany({ data: shifts }),
    prisma.break.createMany({ data: breaks.map((b) => ({ ...b, label: "Break" })) }),
  ]);
  refresh(employeeId);
  return { ok: "Working hours saved. Existing bookings are not changed." };
}

const accountSchema = z.object({
  employeeId: id,
  email: z.string().trim().toLowerCase().email("Enter a valid e-mail"),
  role: z.enum(["STAFF", "OWNER"]),
  password: z.union([z.literal(""), z.string().min(8, "At least 8 characters").max(200)]),
});

export async function saveAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireOwner();
  const parsed = accountSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { employeeId, email, role, password } = parsed.data;
  const existing = await prisma.adminUser.findUnique({ where: { employeeId } });
  if (!existing && !password) return { error: "Set a password for the new login.", fields: { password: "Required for a new login" } };
  if (existing?.id === me.id && role !== "OWNER") return { error: "You can't remove your own owner role." };

  try {
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    if (existing) {
      await prisma.adminUser.update({ where: { id: existing.id }, data: { email, role, ...(passwordHash ? { passwordHash } : {}) } });
    } else {
      await prisma.adminUser.create({ data: { email, role, employeeId, passwordHash: passwordHash! } });
    }
  } catch (e) {
    return toActionError(e);
  }
  refresh(employeeId);
  return { ok: password ? "Login saved with the new password." : "Login saved." };
}

export async function deleteAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireOwner();
  const employeeId = id.parse(fd.get("employeeId"));
  const existing = await prisma.adminUser.findUnique({ where: { employeeId } });
  if (!existing) return { error: "No login to remove." };
  if (existing.id === me.id) return { error: "You can't remove your own login." };
  await prisma.adminUser.delete({ where: { id: existing.id } });
  refresh(employeeId);
  return { ok: "Login removed." };
}
