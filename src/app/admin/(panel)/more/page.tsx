import Link from "next/link";
import { requireUser } from "@/lib/admin/guard";

export default async function MorePage() {
  const user = await requireUser();
  const links = [
    ...(user.role === "OWNER"
      ? [
          { href: "/admin/services", label: "Services & prices", hint: "Options, durations, buffers, who does what" },
          { href: "/admin/staff", label: "Staff & working hours", hint: "Employees, hours, breaks, logins" },
          { href: "/admin/settings", label: "Salon settings", hint: "Address, opening hours, booking rules" },
        ]
      : []),
    { href: "/admin/account", label: "My account", hint: "Change your password" },
    { href: "/", label: "View website", hint: "Open the public site" },
  ];
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-light">More</h1>
      <ul className="mt-6 space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="card flex items-center justify-between gap-4 hover:border-ink">
              <span>
                <span className="block text-lg">{l.label}</span>
                <span className="text-sm text-muted">{l.hint}</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
