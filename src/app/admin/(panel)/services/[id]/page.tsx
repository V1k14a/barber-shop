import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/admin/guard";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/ActionForm";
import { deleteOption, deleteService, saveOption, updateService } from "../actions";

export default async function ServiceEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  await requireOwner();
  const [{ id }, { new: isNew }] = await Promise.all([params, searchParams]);
  const [service, employees] = await Promise.all([
    prisma.service.findUnique({
      where: { id },
      include: { options: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }, employees: true },
    }),
    prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  if (!service) notFound();
  const assigned = new Set(service.employees.map((e) => e.employeeId));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/services" className="text-sm underline-offset-4 hover:underline">
        ← All services
      </Link>
      {isNew && <p className="border border-success/30 bg-success/5 px-4 py-3 text-success">Service created. Add options, pick who performs it, then tick “Active”.</p>}

      <section className="card">
        <h1 className="text-2xl font-light">{service.name}</h1>
        <ActionForm action={updateService} className="mt-4 space-y-4">
          <input type="hidden" name="serviceId" value={service.id} />
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div>
              <label htmlFor="name" className="label">
                Name
              </label>
              <input id="name" name="name" defaultValue={service.name} required className="input" />
              <FieldError name="name" />
            </div>
            <div>
              <label htmlFor="sortOrder" className="label">
                Order
              </label>
              <input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={service.sortOrder} className="input" />
            </div>
          </div>
          <div>
            <label htmlFor="description" className="label">
              Description (website)
            </label>
            <textarea id="description" name="description" rows={2} maxLength={300} defaultValue={service.description} className="input" />
          </div>
          <fieldset>
            <legend className="label">Performed by</legend>
            <div className="flex flex-wrap gap-2">
              {employees.map((e) => (
                <label key={e.id} className="btn btn-quiet cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper">
                  <input type="checkbox" name="employeeIds[]" value={e.id} defaultChecked={assigned.has(e.id)} className="sr-only" />
                  {e.name}
                  {!e.active && " (inactive)"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" name="active" defaultChecked={service.active} className="h-5 w-5 accent-ink" />
            Active (shown on the website and bookable)
          </label>
          <SubmitButton className="btn btn-primary w-full">Save service</SubmitButton>
        </ActionForm>
      </section>

      <section>
        <h2 className="text-xl font-light">Options</h2>
        <p className="text-sm text-muted">Buffer = extra minutes after the appointment when the employee can&apos;t be booked (cleaning, drying).</p>
        <div className="mt-4 space-y-3">
          {service.options.map((o) => (
            <div key={o.id} className="card">
              <OptionFields serviceId={service.id} option={o} />
              <ActionForm action={deleteOption} confirm={`Delete “${o.name}”?`} className="mt-2">
                <input type="hidden" name="optionId" value={o.id} />
                <SubmitButton className="text-sm text-danger underline-offset-4 hover:underline" pendingText="Deleting…">
                  Delete option
                </SubmitButton>
              </ActionForm>
            </div>
          ))}
          <div className="card border-dashed">
            <h3 className="mb-3">Add option</h3>
            <OptionFields serviceId={service.id} />
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg">Delete service</h2>
        <p className="text-sm text-muted">Only possible when it has never been booked. Otherwise untick “Active”.</p>
        <ActionForm action={deleteService} confirm={`Delete “${service.name}” permanently?`} className="mt-3">
          <input type="hidden" name="serviceId" value={service.id} />
          <SubmitButton className="btn btn-danger">Delete service</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}

function OptionFields({
  serviceId,
  option,
}: {
  serviceId: string;
  option?: { id: string; name: string; description: string; durationMin: number; priceOre: number; bufferMin: number; sortOrder: number; active: boolean };
}) {
  const p = option?.id ?? "new";
  return (
    <ActionForm action={saveOption} resetOnSuccess={!option} className="space-y-3">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="optionId" value={option?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${p}-name`} className="label">
            Name
          </label>
          <input id={`${p}-name`} name="name" defaultValue={option?.name} required className="input" />
          <FieldError name="name" />
        </div>
        <div>
          <label htmlFor={`${p}-description`} className="label">
            Short description (optional)
          </label>
          <input id={`${p}-description`} name="description" defaultValue={option?.description} maxLength={200} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor={`${p}-duration`} className="label">
            Minutes
          </label>
          <input id={`${p}-duration`} name="durationMin" type="number" inputMode="numeric" min={5} max={600} step={5} defaultValue={option?.durationMin ?? 30} required className="input" />
          <FieldError name="durationMin" />
        </div>
        <div>
          <label htmlFor={`${p}-price`} className="label">
            Price (kr.)
          </label>
          <input id={`${p}-price`} name="price" inputMode="decimal" defaultValue={option ? String(option.priceOre / 100).replace(".", ",") : ""} required className="input" />
          <FieldError name="price" />
        </div>
        <div>
          <label htmlFor={`${p}-buffer`} className="label">
            Buffer (min)
          </label>
          <input id={`${p}-buffer`} name="bufferMin" type="number" inputMode="numeric" min={0} max={120} step={5} defaultValue={option?.bufferMin ?? 0} className="input" />
        </div>
        <div>
          <label htmlFor={`${p}-sort`} className="label">
            Order
          </label>
          <input id={`${p}-sort`} name="sortOrder" type="number" min={0} defaultValue={option?.sortOrder ?? 0} className="input" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" name="active" defaultChecked={option?.active ?? true} className="h-5 w-5 accent-ink" />
          Active
        </label>
        <SubmitButton className="btn btn-secondary">{option ? "Save option" : "Add option"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
