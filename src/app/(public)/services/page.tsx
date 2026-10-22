import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatDuration, formatPrice } from "@/lib/format";
import { getServiceCatalog } from "@/lib/salon";

export const metadata: Metadata = { title: "Services & prices" };

export default async function ServicesPage() {
  const services = await getServiceCatalog();

  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6 md:pt-16">
      <p className="eyebrow">Price list</p>
      <h1 className="mt-2 text-4xl font-light tracking-tight sm:text-5xl">Services & prices</h1>
      <p className="mt-4 max-w-xl text-muted">All prices in Danish kroner, including VAT. Durations are approximate.</p>

      <nav aria-label="Services" className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {services.map((s) => (
          <a key={s.id} href={`#${s.slug}`} className="shrink-0 border border-line bg-white px-4 py-2 text-sm hover:border-ink">
            {s.name}
          </a>
        ))}
      </nav>

      <div className="mt-12 space-y-16">
        {services.map((s) => (
          <section key={s.id} id={s.slug} className="scroll-mt-24">
            <SectionHeading eyebrow={s.employees.map((e) => e.employee.name.split(" ")[0]).join(" · ") || "Service"} title={s.name}>
              {s.description}
            </SectionHeading>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {s.options.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg">{o.name}</p>
                    <p className="text-sm text-muted">
                      {formatDuration(o.durationMin)}
                      {o.description && ` · ${o.description}`}
                    </p>
                  </div>
                  <p className="text-lg tabular-nums">{formatPrice(o.priceOre)}</p>
                  <Link
                    href={`/booking?service=${s.slug}&option=${o.id}`}
                    className="border border-ink px-5 py-2.5 text-sm tracking-wide hover:bg-ink hover:text-paper"
                    aria-label={`Book ${s.name}: ${o.name}`}
                  >
                    Book
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
