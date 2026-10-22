import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/admin/guard";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/ActionForm";
import type { OpeningHoursLine } from "@/lib/salon";
import { saveSettings } from "./actions";

export default async function SettingsPage() {
  await requireOwner();
  const s = await prisma.salonSettings.findUniqueOrThrow({ where: { id: 1 } });
  const hours = (s.openingHours as unknown as OpeningHoursLine[]).map((h) => `${h.days} | ${h.hours}`).join("\n");

  const field = (name: keyof typeof s, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input id={name} name={name} defaultValue={String(s[name] ?? "")} className="input" {...props} />
      <FieldError name={name} />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-light">Salon settings</h1>
      <ActionForm action={saveSettings} className="mt-6 space-y-6">
        <section className="card space-y-4">
          <h2 className="text-lg">Salon</h2>
          {field("name", "Name", { required: true })}
          {field("tagline", "Tagline (homepage)")}
          {field("addressLine", "Street address", { required: true })}
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            {field("postalCode", "Postal code", { required: true })}
            {field("city", "City", { required: true })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("phone", "Phone", { type: "tel", required: true })}
            {field("email", "E-mail", { type: "email", required: true })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("latitude", "Map latitude", { inputMode: "decimal" })}
            {field("longitude", "Map longitude", { inputMode: "decimal" })}
          </div>
          <p className="text-sm text-muted">Tip: right-click the salon in Google Maps to copy its coordinates.</p>
          <div>
            <label htmlFor="openingHours" className="label">
              Opening hours on the website — one line each, “Days | Hours”
            </label>
            <textarea id="openingHours" name="openingHours" rows={5} defaultValue={hours} className="input font-mono text-sm" />
            <p className="mt-1 text-sm text-muted">Display text only — bookable times come from each employee&apos;s working hours.</p>
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="text-lg">Online booking rules</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="slotStepMin" className="label">
                Start times every
              </label>
              <select id="slotStepMin" name="slotStepMin" defaultValue={s.slotStepMin} className="input">
                {[5, 10, 15, 20, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
            {field("maxWeeksAhead", "Bookable weeks ahead", { type: "number", min: 1, max: 52 })}
            {field("cancelHoursBefore", "Online cancellation until (hours before)", { type: "number", min: 0, max: 168 })}
            {field("minNoticeMin", "Minimum notice (minutes)", { type: "number", min: 0, step: 15 })}
          </div>
        </section>

        <SubmitButton className="btn btn-primary w-full">Save settings</SubmitButton>
      </ActionForm>
    </div>
  );
}
