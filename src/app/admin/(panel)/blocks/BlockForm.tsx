"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/ActionForm";
import { createBlock } from "./actions";

export function BlockForm({ employees, isOwner, ownEmployeeId, today }: { employees: { id: string; name: string }[]; isOwner: boolean; ownEmployeeId: string | null; today: string }) {
  const [allDay, setAllDay] = useState(true);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const choices = isOwner ? [...employees, { id: "", name: "Whole salon (closed)" }] : employees.filter((e) => e.id === ownEmployeeId);

  return (
    <ActionForm action={createBlock} className="space-y-4">
      <div>
        <p className="label">Who</p>
        <div className="flex flex-wrap gap-2">
          {choices.map((e, i) => (
            <label key={e.id || "salon"} className="btn btn-quiet cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper">
              <input type="radio" name="employeeId" value={e.id} defaultChecked={e.id === ownEmployeeId || (!ownEmployeeId && i === 0)} className="sr-only" />
              {e.name}
            </label>
          ))}
        </div>
        {choices.length === 0 && <p className="text-sm text-muted">Your login is not linked to an employee.</p>}
      </div>

      <div>
        <p className="label">Reason</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["HOLIDAY", "Holiday"],
            ["SICK", "Sick"],
            ["PRIVATE", "Private appointment"],
            ["OTHER", "Other"],
          ].map(([value, label], i) => (
            <label key={value} className="btn btn-quiet cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper">
              <input type="radio" name="type" value={value} defaultChecked={i === 0} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </div>

      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-5 w-5 accent-ink" />
        Whole day(s)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="fromDate" className="label">
            From
          </label>
          <input
            id="fromDate"
            name="fromDate"
            type="date"
            required
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              if (to < e.target.value) setTo(e.target.value);
            }}
            className="input"
          />
          {!allDay && <input name="fromTime" type="time" step={300} required aria-label="From time" className="input mt-2" />}
          <FieldError name="fromTime" />
        </div>
        <div>
          <label htmlFor="toDate" className="label">
            {allDay ? "To (inclusive)" : "To"}
          </label>
          <input id="toDate" name="toDate" type="date" required min={from} value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          {!allDay && <input name="toTime" type="time" step={300} required aria-label="To time" className="input mt-2" />}
          <FieldError name="toDate" />
          <FieldError name="toTime" />
        </div>
      </div>

      <div>
        <label htmlFor="reason" className="label">
          Note (optional, staff only)
        </label>
        <input id="reason" name="reason" maxLength={200} className="input" />
      </div>

      <SubmitButton className="btn btn-primary w-full">Block time</SubmitButton>
    </ActionForm>
  );
}
