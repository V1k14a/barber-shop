import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireUser } from "@/lib/admin/guard";
import { logout } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh bg-paper pb-24 lg:pb-10">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/admin/calendar" className="flex items-center gap-3" aria-label="Admin home">
            <Image src="/logo.png" alt="Salon de Choix" width={497} height={120} className="h-6 w-auto" priority />
            <span className="eyebrow hidden sm:inline">Staff</span>
          </Link>
          <div className="hidden lg:block lg:flex-1">
            <AdminNav isOwner={user.role === "OWNER"} variant="top" />
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.employee?.name ?? user.email}</span>
            <form action={logout}>
              <button type="submit" className="px-3 py-2 underline-offset-4 hover:underline">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">{children}</main>
      <AdminNav isOwner={user.role === "OWNER"} variant="bottom" />
    </div>
  );
}
