import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/admin/guard";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/ActionForm";
import { formatDuration, formatPrice } from "@/lib/format";
import { createService } from "./actions";

export default async function ServicesAdminPage() {
  await requireOwner();
  const services = await prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { options: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }, employees: { include: { employee: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-light">Services & prices</h1>
      <p className="mt-1 text-muted">Changes show on the website immediately.</p>

      <ul className="mt-6 space-y-3">
        {services.map((s) => (
          <li key={s.id}>
            <Link href={`/admin/services/${s.id}`} className="card block hover:border-ink">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-lg">
                  {s.name} {!s.active && <span className="ml-2 bg-sand px-2 py-0.5 text-xs text-muted">Hidden</span>}
                </span>
                <span className="text-sm">Edit →</span>
              </div>
              <p className="mt-1 text-sm text-muted">{s.employees.map((e) => e.employee.name).join(", ") || "Nobody assigned — not bookable"}</p>
              <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                {s.options.map((o) => (
                  <li key={o.id} className={o.active ? "" : "text-muted line-through"}>
                    {o.name} · {formatDuration(o.durationMin)}
                    {o.bufferMin > 0 && ` +${o.bufferMin}`} · {formatPrice(o.priceOre)}
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>

      <section className="card mt-8">
        <h2 className="text-lg">Add a service</h2>
        <ActionForm action={createService} className="mt-3">
          <div className="flex gap-2">
            <input name="name" placeholder="e.g. Colouring" required aria-label="Service name" className="input" />
            <SubmitButton className="btn btn-primary shrink-0">Add</SubmitButton>
          </div>
          <FieldError name="name" />
        </ActionForm>
      </section>
    </div>
  );
}
