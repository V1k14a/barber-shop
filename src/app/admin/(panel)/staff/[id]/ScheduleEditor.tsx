"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { saveSchedule } from "../actions";

type Range = { start: string; end: string };
export type Day = { weekday: number; shifts: Range[]; breaks: Range[] };

const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ScheduleEditor({ employeeId, initial }: { employeeId: string; initial: Day[] }) {
  const [days, setDays] = useState<Day[]>(initial);
  const update = (weekday: number, fn: (d: Day) => Day) => setDays((ds) => ds.map((d) => (d.weekday === weekday ? fn(d) : d)));

  const copyToWeekdays = (from: Day) =>
    setDays((ds) => ds.map((d) => (d.weekday <= 5 && d.weekday !== from.weekday ? { ...d, shifts: [...from.shifts], breaks: [...from.breaks] } : d)));

  return (
    <ActionForm action={saveSchedule} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="schedule" value={JSON.stringify(days)} />
      {days.map((d) => {
        const working = d.shifts.length > 0;
        return (
          <div key={d.weekday} className="border border-line p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-h-11 items-center gap-3 text-lg">
                <input
                  type="checkbox"
                  checked={working}
                  onChange={(e) => update(d.weekday, (x) => (e.target.checked ? { ...x, shifts: [{ start: "09:00", end: "17:00" }] } : { ...x, shifts: [], breaks: [] }))}
                  className="h-5 w-5 accent-ink"
                />
                {NAMES[d.weekday - 1]}
              </label>
              {!working && <span className="text-muted">Day off</span>}
              {working && d.weekday <= 5 && (
                <button type="button" onClick={() => copyToWeekdays(d)} className="text-sm text-muted underline-offset-4 hover:underline">
                  Copy to Mon–Fri
                </button>
              )}
            </div>
            {working && (
              <div className="mt-2 space-y-2">
                <Ranges label="Working" ranges={d.shifts} onChange={(shifts) => update(d.weekday, (x) => ({ ...x, shifts }))} addLabel="+ Split shift" />
                <Ranges label="Break" ranges={d.breaks} onChange={(breaks) => update(d.weekday, (x) => ({ ...x, breaks }))} addLabel="+ Break" allowEmpty />
              </div>
            )}
          </div>
        );
      })}
      <SubmitButton className="btn btn-primary w-full">Save working hours</SubmitButton>
    </ActionForm>
  );
}

function Ranges({ label, ranges, onChange, addLabel, allowEmpty }: { label: string; ranges: Range[]; onChange: (r: Range[]) => void; addLabel: string; allowEmpty?: boolean }) {
  const set = (i: number, key: keyof Range, v: string) => onChange(ranges.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div className="space-y-2">
      {ranges.map((r, i) => (
        <div key={i}>
          <span className="text-xs tracking-wider text-muted uppercase">{label}</span>
          <div className="mt-1 flex items-center gap-2">
            <input type="time" step={300} value={r.start} onChange={(e) => set(i, "start", e.target.value)} required aria-label={`${label} from`} className="input min-w-0 flex-1 px-2" />
            <span aria-hidden>–</span>
            <input type="time" step={300} value={r.end} onChange={(e) => set(i, "end", e.target.value)} required aria-label={`${label} to`} className="input min-w-0 flex-1 px-2" />
            {(allowEmpty || ranges.length > 1) && (
              <button type="button" onClick={() => onChange(ranges.filter((_, j) => j !== i))} className="btn btn-quiet shrink-0 px-3" aria-label={`Remove ${label.toLowerCase()}`}>
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
      {ranges.length < 4 && (
        <button
          type="button"
          onClick={() => onChange([...ranges, label === "Break" ? { start: "12:00", end: "12:30" } : { start: "13:00", end: "17:00" }])}
          className="text-sm underline-offset-4 hover:underline"
        >
          {addLabel}
        </button>
      )}
    </div>
  );
}
