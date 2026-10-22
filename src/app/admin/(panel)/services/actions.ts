"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/admin/guard";
import { checkbox, formToObject, invalid, krToOre, toActionError, type ActionState } from "@/lib/admin/action";

const id = z.string().min(1).max(64);

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "service"
  );
}

function refresh(serviceId?: string) {
  revalidatePath("/admin/services");
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/", "layout"); // public pages show services and prices
}

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  description: z.string().trim().max(300).default(""),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: checkbox,
  "employeeIds[]": z.array(id).default([]),
});

export async function createService(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner();
  const parsed = z.object({ name: serviceSchema.shape.name }).safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  let slug = slugify(parsed.data.name);
  if (await prisma.service.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const count = await prisma.service.count();
  const service = await prisma.service.create({ data: { name: parsed.data.name, slug, sortOrder: count, active: false } });
  refresh();
  redirect(`/admin/services/${service.id}?new=1`);
}

export async function updateService(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner();
  const serviceId = id.parse(fd.get("serviceId"));
  const parsed = serviceSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { "employeeIds[]": employeeIds, ...data } = parsed.data;
  await prisma.$transaction([
    prisma.service.update({ where: { id: serviceId }, data }),
    prisma.employeeService.deleteMany({ where: { serviceId, employeeId: { notIn: employeeIds } } }),
    ...employeeIds.map((employeeId) =>
      prisma.employeeService.upsert({
        where: { employeeId_serviceId: { employeeId, serviceId } },
        update: {},
        create: { employeeId, serviceId },
      }),
    ),
  ]);
  refresh(serviceId);
  return { ok: "Service saved." };
}

export async function deleteService(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner();
  const serviceId = id.parse(fd.get("serviceId"));
  const used = await prisma.booking.count({ where: { option: { serviceId } } });
  if (used > 0) return { error: `This service has ${used} booking(s) in its history. Untick “Active” to hide it instead.` };
  await prisma.service.delete({ where: { id: serviceId } });
  refresh();
  redirect("/admin/services");
}

const optionSchema = z.object({
  serviceId: id,
  name: z.string().trim().min(2, "Enter a name").max(80),
  description: z.string().trim().max(200).default(""),
  durationMin: z.coerce.number().int().min(5, "At least 5 minutes").max(600),
  price: krToOre,
  bufferMin: z.coerce.number().int().min(0).max(120).default(0),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: checkbox,
});

export async function saveOption(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner();
  const optionId = String(fd.get("optionId") ?? "");
  const parsed = optionSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const { price, serviceId, ...rest } = parsed.data;
  const data = { ...rest, priceOre: price };
  if (optionId) {
    await prisma.serviceOption.update({ where: { id: optionId, serviceId }, data });
  } else {
    const count = await prisma.serviceOption.count({ where: { serviceId } });
    await prisma.serviceOption.create({ data: { ...data, serviceId, sortOrder: data.sortOrder || count } });
  }
  refresh(serviceId);
  return { ok: optionId ? "Option saved. Existing bookings keep their original price and duration." : "Option added." };
}

export async function deleteOption(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner();
  const optionId = id.parse(fd.get("optionId"));
  try {
    const o = await prisma.serviceOption.delete({ where: { id: optionId } });
    refresh(o.serviceId);
    return { ok: "Option deleted." };
  } catch (e) {
    return toActionError(e);
  }
}
