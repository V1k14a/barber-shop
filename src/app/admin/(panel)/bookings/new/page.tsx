import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/admin/guard";
import { NewBookingForm, type NewBookingCatalog } from "./NewBookingForm";

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const { date } = await searchParams;
  const settings = await prisma.salonSettings.findUnique({ where: { id: 1 }, select: { timezone: true } });
  const today = DateTime.now().setZone(settings?.timezone ?? "Europe/Copenhagen").toISODate()!;

  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      options: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      employees: { where: { employee: { active: true } }, include: { employee: true } },
    },
  });
  const catalog: NewBookingCatalog = services.map((s) => ({
    id: s.id,
    name: s.name,
    options: s.options.map((o) => ({ id: o.id, name: o.name, durationMin: o.durationMin, priceOre: o.priceOre })),
    employees: s.employees
      .map((e) => e.employee)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e) => ({ id: e.id, name: e.name })),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-light">New booking</h1>
      <p className="mt-1 text-muted">For phone calls and walk-ins. You can choose any free time, also outside the 15-minute grid.</p>
      <div className="mt-6">
        <NewBookingForm catalog={catalog} defaultDate={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today} defaultEmployeeId={user.employeeId ?? undefined} />
      </div>
    </div>
  );
}
