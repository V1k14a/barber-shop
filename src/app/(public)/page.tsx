import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { PhotoPlaceholder } from "@/components/ui/PhotoPlaceholder";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatPrice } from "@/lib/format";
import { getSalonSettings, getServiceCatalog, getTeam } from "@/lib/salon";

export default async function HomePage() {
  const [settings, services, team] = await Promise.all([getSalonSettings(), getServiceCatalog(), getTeam()]);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-2 md:pt-20 md:pb-24">
        <div>
          <p className="eyebrow">Hair · Beard · Nails</p>
          <h1 className="mt-4 text-5xl leading-[1.05] font-light tracking-tight sm:text-6xl">
            Look good.
            <br />
            Feel good.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">{settings.tagline}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/booking" className="bg-ink px-8 py-4 text-center text-lg tracking-wide text-paper hover:bg-ink/85">
              Book an appointment
            </Link>
            <Link href="/services" className="border border-ink px-8 py-4 text-center text-lg tracking-wide hover:bg-ink hover:text-paper">
              Services & prices
            </Link>
          </div>
        </div>
        <PhotoPlaceholder label="Salon interior" className="aspect-[4/5] w-full md:aspect-[4/5]" />
      </section>

      {/* Services */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <SectionHeading eyebrow="What we do" title="Services">
            From a quick beard trim to a full spa pedicure — book online in under a minute.
          </SectionHeading>
          <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <Link key={s.id} href={`/services#${s.slug}`} className="group flex flex-col bg-white p-6 transition hover:bg-paper">
                <h3 className="text-xl">{s.name}</h3>
                <p className="mt-2 flex-1 text-sm text-muted">{s.description}</p>
                {s.options.length > 0 && (
                  <p className="mt-6 text-sm">from {formatPrice(Math.min(...s.options.map((o) => o.priceOre)))}</p>
                )}
                <span className="mt-2 text-sm underline-offset-4 group-hover:underline">See options →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
        <PhotoPlaceholder label="Our team at work" className="order-last aspect-[4/3] w-full md:order-first" />
        <div>
          <SectionHeading eyebrow="About us" title="Barber and beauty under one roof">
            <p>
              {settings.name} is a neighbourhood salon where you can get a sharp cut, a clean beard and
              beautiful nails in one visit. We take our time, use quality products and always tell you
              the price up front.
            </p>
            <p className="mt-4">Placeholder text — replace with the salon&apos;s own story.</p>
          </SectionHeading>
        </div>
      </section>

      {/* Team preview */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="The team" title="Meet the people behind the chair" />
            <Link href="/team" className="underline underline-offset-4">
              Meet the team →
            </Link>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
            {team.map((e) => (
              <li key={e.id} className="flex flex-col items-center text-center">
                <Avatar name={e.name} photoUrl={e.photoUrl} size={112} />
                <p className="mt-4 text-lg">{e.name}</p>
                <p className="text-sm text-muted">{e.title}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Visit */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-10 border border-line bg-white p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="eyebrow">Visit us</p>
            <p className="mt-3 text-2xl font-light">
              {settings.addressLine}, {settings.postalCode} {settings.city}
            </p>
            <ul className="mt-4 space-y-1 text-muted">
              {settings.openingHours.map((o) => (
                <li key={o.days}>
                  {o.days}: {o.hours}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/booking" className="bg-ink px-8 py-4 text-center tracking-wide text-paper hover:bg-ink/85">
              Book now
            </Link>
            <Link href="/contact" className="border border-ink px-8 py-4 text-center tracking-wide hover:bg-ink hover:text-paper">
              Directions & contact
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
