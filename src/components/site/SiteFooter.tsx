import Link from "next/link";
import { getSalonSettings } from "@/lib/salon";

export async function SiteFooter() {
  const s = await getSalonSettings();
  return (
    <footer className="mt-24 border-t border-line bg-sand">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="eyebrow mb-3">Visit us</p>
          <p>{s.addressLine}</p>
          <p>
            {s.postalCode} {s.city}
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">Contact</p>
          <p>
            <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="hover:underline">
              {s.phone}
            </a>
          </p>
          <p>
            <a href={`mailto:${s.email}`} className="hover:underline">
              {s.email}
            </a>
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">Opening hours</p>
          <ul className="space-y-1">
            {s.openingHours.map((o) => (
              <li key={o.days} className="flex justify-between gap-4">
                <span>{o.days}</span>
                <span className="text-muted">{o.hours}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 pb-8 text-sm text-muted sm:px-6">
        <span>© {new Date().getFullYear()} {s.name}</span>
        <Link href="/admin" className="hover:underline">
          Staff login
        </Link>
      </div>
    </footer>
  );
}
