import type { Metadata } from "next";
import Link from "next/link";
import { getSalonSettings } from "@/lib/salon";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const s = await getSalonSettings();
  const d = 0.004; // map viewport around the salon
  const bbox = [s.longitude - d * 1.6, s.latitude - d, s.longitude + d * 1.6, s.latitude + d].join(",");
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${s.latitude},${s.longitude}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.addressLine}, ${s.postalCode} ${s.city}`)}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 md:pt-16">
      <p className="eyebrow">Contact</p>
      <h1 className="mt-2 text-4xl font-light tracking-tight sm:text-5xl">Find us</h1>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-10">
          <section>
            <h2 className="eyebrow mb-3">Address</h2>
            <p className="text-xl font-light">
              {s.addressLine}
              <br />
              {s.postalCode} {s.city}
            </p>
            <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block underline underline-offset-4">
              Get directions ↗
            </a>
          </section>

          <section>
            <h2 className="eyebrow mb-3">Contact</h2>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
              <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="flex-1 border border-ink px-5 py-3 text-center hover:bg-ink hover:text-paper">
                Call {s.phone}
              </a>
              <a href={`mailto:${s.email}`} className="flex-1 border border-line bg-white px-5 py-3 text-center hover:border-ink">
                {s.email}
              </a>
            </div>
          </section>

          <section>
            <h2 className="eyebrow mb-3">Opening hours</h2>
            <dl className="divide-y divide-line border-y border-line">
              {s.openingHours.map((o) => (
                <div key={o.days} className="flex justify-between gap-4 py-3">
                  <dt>{o.days}</dt>
                  <dd className="text-muted">{o.hours}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Link href="/booking" className="block bg-ink px-8 py-4 text-center text-lg tracking-wide text-paper hover:bg-ink/85">
            Book an appointment
          </Link>
        </div>

        <div className="min-h-80 border border-line bg-sand md:min-h-[32rem]">
          <iframe
            title={`Map showing ${s.name}`}
            src={mapSrc}
            className="h-full min-h-80 w-full md:min-h-[32rem]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
}
