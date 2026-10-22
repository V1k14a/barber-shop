"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/admin/guard";
import { formToObject, invalid, type ActionState } from "@/lib/admin/action";

const schema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "At least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const parsed = schema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "Current password is wrong.", fields: { current: "Wrong password" } };
  }
  await prisma.adminUser.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
  return { ok: "Password changed." };
}
