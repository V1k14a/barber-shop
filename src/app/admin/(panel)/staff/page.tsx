import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/admin/guard";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/ActionForm";
import { Avatar } from "@/components/ui/Avatar";
import { minutesToHhmm } from "@/lib/admin/action";
import { createEmployee } from "./actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function StaffPage() {
  await requireOwner();
  const employees = await prisma.employee.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { services: { include: { service: true } }, workingHours: { orderBy: { startMin: "asc" } }, user: true },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-light">Staff & working hours</h1>
      <ul className="mt-6 space-y-3">
        {employees.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/staff/${e.id}`} className="card flex gap-4 hover:border-ink">
              <Avatar name={e.name} photoUrl={e.photoUrl} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-lg">
                    {e.name} {!e.active && <span className="ml-2 bg-sand px-2 py-0.5 text-xs text-muted">Inactive</span>}
                  </span>
                  <span className="text-sm">Edit →</span>
                </div>
                <p className="text-sm text-muted">
                  {e.title || "—"} · {e.services.map((s) => s.service.name).join(", ") || "No services"}
                </p>
                <p className="mt-2 text-sm">
                  {DAYS.map((d, i) => {
                    const hours = e.workingHours.filter((h) => h.weekday === i + 1);
                    return hours.length ? (
                      <span key={d} className="mr-3 inline-block">
                        {d} {hours.map((h) => `${minutesToHhmm(h.startMin)}–${minutesToHhmm(h.endMin)}`).join(", ")}
                      </span>
                    ) : null;
                  })}
                </p>
                {!e.user && <p className="mt-1 text-sm text-muted">No login</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <section className="card mt-8">
        <h2 className="text-lg">Add an employee</h2>
        <ActionForm action={createEmployee} className="mt-3">
          <div className="flex gap-2">
            <input name="name" placeholder="Full name" required aria-label="Employee name" className="input" />
            <SubmitButton className="btn btn-primary shrink-0">Add</SubmitButton>
          </div>
          <FieldError name="name" />
        </ActionForm>
      </section>
    </div>
  );
}
