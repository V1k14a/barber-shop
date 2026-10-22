import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getBookingRules } from "@/lib/booking/service";
import { lastBookableDate, toLocalDate } from "@/lib/scheduling";
import { getServiceCatalog } from "@/lib/salon";
import { BookingWizard, type CatalogService } from "@/components/booking/BookingWizard";

export const metadata: Metadata = { title: "Book an appointment" };
export const dynamic = "force-dynamic";

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; option?: string; employee?: string }>;
}) {
  const [catalog, rules, params] = await Promise.all([getServiceCatalog(), getBookingRules(prisma), searchParams]);
  const now = new Date();

  const services: CatalogService[] = catalog
    .filter((s) => s.options.length > 0 && s.employees.length > 0)
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      options: s.options.map((o) => ({
        id: o.id,
        name: o.name,
        description: o.description,
        durationMin: o.durationMin,
        priceOre: o.priceOre,
      })),
      employees: s.employees
        .map((es) => es.employee)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map(({ id, name, title, photoUrl }) => ({ id, name, title, photoUrl })),
    }));

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="eyebrow">Online booking</p>
      <h1 className="mt-2 text-3xl font-light tracking-tight sm:text-4xl">Book an appointment</h1>
      <BookingWizard
        services={services}
        timezone={rules.timezone}
        today={toLocalDate(now, rules.timezone)}
        lastDate={lastBookableDate(now, rules)}
        initial={{ service: params.service, option: params.option, employee: params.employee }}
      />
    </div>
  );
}
