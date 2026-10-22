import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * Returns the signed-in admin user (fresh from the database, so deleted
 * accounts lose access immediately) or redirects to the login page.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  const user = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, employeeId: true, employee: { select: { id: true, name: true } } },
  });
  if (!user) redirect("/admin/login");
  return user;
}

export type AdminUserInfo = Awaited<ReturnType<typeof requireUser>>;

/** Owner-only pages and actions. */
export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/admin/calendar?denied=1");
  return user;
}

/** For API routes: returns null instead of redirecting. */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.adminUser.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, employeeId: true } });
}
