"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };

const main: Item[] = [
  { href: "/admin/calendar", label: "Calendar", icon: "M4 6h16M4 6v14h16V6M8 3v6M16 3v6M4 11h16" },
  { href: "/admin/bookings/new", label: "New booking", icon: "M12 5v14M5 12h14" },
  { href: "/admin/blocks", label: "Time off", icon: "M5 5l14 14M12 3a9 9 0 100 18 9 9 0 000-18z" },
];
const owner: Item[] = [
  { href: "/admin/services", label: "Services", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/admin/staff", label: "Staff & hours", icon: "M16 11a4 4 0 10-8 0M4 21a8 8 0 0116 0" },
  { href: "/admin/settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12h2M3 12h2M12 3v2M12 19v2" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d={d} />
    </svg>
  );
}

/**
 * "top": desktop / tablet-landscape bar inside the header.
 * "bottom": phone / tablet-portrait tab bar. Must be rendered outside the
 * header — its backdrop-filter would otherwise trap `position: fixed`.
 */
export function AdminNav({ isOwner, variant }: { isOwner: boolean; variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || (href !== "/admin/bookings/new" && pathname.startsWith(href + "/"));
  const more: Item = { href: "/admin/more", label: "More", icon: "M5 12h.01M12 12h.01M19 12h.01" };

  if (variant === "top")
    return (
      <nav aria-label="Admin" className="hidden flex-wrap gap-1 lg:flex">
        {[...main, ...(isOwner ? owner : []), { href: "/admin/account", label: "My account", icon: "" }].map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`px-4 py-3 text-sm tracking-wide ${active(i.href) ? "bg-ink text-paper" : "hover:bg-sand"}`}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    );

  return (
      <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {[...main, more].map((i) => {
          const on = i.href === "/admin/more" ? ["/admin/more", "/admin/services", "/admin/staff", "/admin/settings", "/admin/account"].some((p) => pathname.startsWith(p)) : active(i.href);
          return (
            <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-1 py-2.5 text-xs ${on ? "text-ink" : "text-muted"}`}>
              <span className={`flex h-8 w-14 items-center justify-center rounded-full ${on ? "bg-sand" : ""}`}>
                <Icon d={i.icon} />
              </span>
              {i.label}
            </Link>
          );
        })}
      </nav>
  );
}
