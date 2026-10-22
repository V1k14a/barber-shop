import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/admin/guard";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/ActionForm";
import { minutesToHhmm } from "@/lib/admin/action";
import { deleteAccount, saveAccount, updateEmployee } from "../actions";
import { ScheduleEditor, type Day } from "./ScheduleEditor";

export default async function EmployeeEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const me = await requireOwner();
  const [{ id }, { new: isNew }] = await Promise.all([params, searchParams]);
  const [employee, services] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: { services: true, workingHours: { orderBy: { startMin: "asc" } }, breaks: { orderBy: { startMin: "asc" } }, user: true },
    }),
    prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  if (!employee) notFound();
  const performs = new Set(employee.services.map((s) => s.serviceId));
  const toRange = (r: { startMin: number; endMin: number }) => ({ start: minutesToHhmm(r.startMin), end: minutesToHhmm(r.endMin) });
  const schedule: Day[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    shifts: employee.workingHours.filter((h) => h.weekday === weekday).map(toRange),
    breaks: employee.breaks.filter((b) => b.weekday === weekday).map(toRange),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/staff" className="text-sm underline-offset-4 hover:underline">
        ← All staff
      </Link>
      {isNew && <p className="border border-success/30 bg-success/5 px-4 py-3 text-success">Employee added. Choose their services and working hours below.</p>}

      <section className="card">
        <h1 className="text-2xl font-light">{employee.name}</h1>
        <ActionForm action={updateEmployee} className="mt-4 space-y-4">
          <input type="hidden" name="employeeId" value={employee.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="label">
                Name
              </label>
              <input id="name" name="name" defaultValue={employee.name} required className="input" />
              <FieldError name="name" />
            </div>
            <div>
              <label htmlFor="title" className="label">
                Title
              </label>
              <input id="title" name="title" defaultValue={employee.title} placeholder="e.g. Barber" className="input" />
            </div>
          </div>
          <div>
            <label htmlFor="bio" className="label">
              Short bio (website)
            </label>
            <textarea id="bio" name="bio" rows={3} maxLength={600} defaultValue={employee.bio} className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div>
              <label htmlFor="photoUrl" className="label">
                Photo URL (optional)
              </label>
              <input id="photoUrl" name="photoUrl" type="url" defaultValue={employee.photoUrl ?? ""} placeholder="https://… or /images/name.jpg" className="input" />
              <FieldError name="photoUrl" />
            </div>
            <div>
              <label htmlFor="sortOrder" className="label">
                Order
              </label>
              <input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={employee.sortOrder} className="input" />
            </div>
          </div>
          <fieldset>
            <legend className="label">Services</legend>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <label key={s.id} className="btn btn-quiet cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper">
                  <input type="checkbox" name="serviceIds[]" value={s.id} defaultChecked={performs.has(s.id)} className="sr-only" />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" name="active" defaultChecked={employee.active} className="h-5 w-5 accent-ink" />
            Active (shown on the website and bookable)
          </label>
          <SubmitButton className="btn btn-primary w-full">Save profile</SubmitButton>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="text-xl font-light">Weekly working hours</h2>
        <p className="mb-4 text-sm text-muted">For holidays and one-off days off, use “Time off” instead.</p>
        <ScheduleEditor employeeId={employee.id} initial={schedule} />
      </section>

      <section className="card">
        <h2 className="text-xl font-light">Login</h2>
        <p className="mb-4 text-sm text-muted">{employee.user ? "This employee can log in to the staff area." : "No login yet — fill in to create one."}</p>
        <ActionForm action={saveAccount} className="space-y-4">
          <input type="hidden" name="employeeId" value={employee.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="label">
                E-mail
              </label>
              <input id="email" name="email" type="email" defaultValue={employee.user?.email ?? ""} required autoComplete="off" className="input" />
              <FieldError name="email" />
            </div>
            <div>
              <label htmlFor="role" className="label">
                Role
              </label>
              <select id="role" name="role" defaultValue={employee.user?.role ?? "STAFF"} className="input">
                <option value="STAFF">Staff — calendar, bookings, own time off</option>
                <option value="OWNER">Owner — everything</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="password" className="label">
              {employee.user ? "New password (leave empty to keep)" : "Password"}
            </label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} className="input" />
            <FieldError name="password" />
          </div>
          <SubmitButton className="btn btn-secondary w-full">{employee.user ? "Save login" : "Create login"}</SubmitButton>
        </ActionForm>
        {employee.user && employee.user.id !== me.id && (
          <ActionForm action={deleteAccount} confirm="Remove this login? The employee will no longer be able to sign in." className="mt-3">
            <input type="hidden" name="employeeId" value={employee.id} />
            <SubmitButton className="text-sm text-danger underline-offset-4 hover:underline">Remove login</SubmitButton>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
