"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/ActionForm";
import { SlotPicker } from "@/components/admin/SlotPicker";
import { formatDuration, formatPrice } from "@/lib/format";
import { createAdminBooking } from "../actions";

export type NewBookingCatalog = {
  id: string;
  name: string;
  options: { id: string; name: string; durationMin: number; priceOre: number }[];
  employees: { id: string; name: string }[];
}[];

export function NewBookingForm({ catalog, defaultDate, defaultEmployeeId }: { catalog: NewBookingCatalog; defaultDate: string; defaultEmployeeId?: string }) {
  const [optionId, setOptionId] = useState("");
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "any");
  const service = catalog.find((s) => s.options.some((o) => o.id === optionId));
  const employees = service?.employees ?? [];
  const validEmployee = employeeId === "any" || employees.some((e) => e.id === employeeId) ? employeeId : "any";

  return (
    <ActionForm action={createAdminBooking} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="text-lg">Service</h2>
        <div>
          <label htmlFor="optionId" className="label">
            Service & option
          </label>
          <select id="optionId" name="optionId" required value={optionId} onChange={(e) => setOptionId(e.target.value)} className="input">
            <option value="">Choose…</option>
            {catalog.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {s.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {formatDuration(o.durationMin)}, {formatPrice(o.priceOre)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <FieldError name="optionId" />
        </div>
        {service && (
          <div>
            <p className="label">Employee</p>
            <div className="flex flex-wrap gap-2">
              {[{ id: "any", name: "First available" }, ...employees].map((e) => (
                <label key={e.id} className={`btn cursor-pointer ${validEmployee === e.id ? "btn-primary" : "btn-quiet"}`}>
                  <input type="radio" name="employeeId" value={e.id} checked={validEmployee === e.id} onChange={() => setEmployeeId(e.id)} className="sr-only" />
                  {e.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg">When</h2>
        <SlotPicker optionId={optionId || undefined} employeeId={validEmployee === "any" ? undefined : validEmployee} defaultDate={defaultDate} />
        <FieldError name="date" />
        <FieldError name="time" />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg">Customer</h2>
        <div>
          <label htmlFor="customerName" className="label">
            Name
          </label>
          <input id="customerName" name="customerName" required autoComplete="off" className="input" />
          <FieldError name="customerName" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="customerPhone" className="label">
              Phone
            </label>
            <input id="customerPhone" name="customerPhone" type="tel" inputMode="tel" required autoComplete="off" className="input" />
            <FieldError name="customerPhone" />
          </div>
          <div>
            <label htmlFor="customerEmail" className="label">
              E-mail (optional)
            </label>
            <input id="customerEmail" name="customerEmail" type="email" inputMode="email" autoComplete="off" className="input" />
            <FieldError name="customerEmail" />
          </div>
        </div>
        <div>
          <label htmlFor="note" className="label">
            Note (optional)
          </label>
          <textarea id="note" name="note" rows={2} maxLength={500} className="input" />
        </div>
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" name="sendEmail" defaultChecked className="h-5 w-5 accent-ink" />
          Send confirmation e-mail (if an e-mail is given)
        </label>
      </section>

      <SubmitButton className="btn btn-primary w-full text-lg" pendingText="Booking…">
        Create booking
      </SubmitButton>
    </ActionForm>
  );
}
