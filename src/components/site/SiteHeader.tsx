"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/services", label: "Services & prices" },
  { href: "/team", label: "Team" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" onClick={() => setOpen(false)} aria-label="Salon de Choix — home">
          <Image src="/logo.png" alt="Salon de Choix" width={497} height={120} priority className="h-7 w-auto sm:h-8" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`text-sm tracking-wide hover:underline underline-offset-8 ${pathname.startsWith(n.href) ? "underline" : ""}`}
            >
              {n.label}
            </Link>
          ))}
          <Link href="/booking" className="bg-ink px-5 py-2.5 text-sm tracking-wide text-paper hover:bg-ink/85">
            Book now
          </Link>
        </nav>

        <button
          type="button"
          className="-mr-2 p-2 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-line px-4 pb-6 md:hidden" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block border-b border-line py-4 text-lg">
              {n.label}
            </Link>
          ))}
          <Link href="/booking" onClick={() => setOpen(false)} className="mt-6 block bg-ink py-4 text-center text-lg text-paper">
            Book now
          </Link>
        </nav>
      )}
    </header>
  );
}
