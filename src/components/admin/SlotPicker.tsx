"use client";

import { useEffect, useState } from "react";

/**
 * Date + time inputs for staff. Shows free times for the chosen option and
 * employee as quick-pick buttons; any other time can be typed in.
 * Submits as `date` (YYYY-MM-DD) and `time` (HH:MM).
 */
export function SlotPicker({
  optionId,
  employeeId,
  defaultDate,
  defaultTime = "",
  excludeBookingId,
}: {
  optionId?: string;
  employeeId?: string;
  defaultDate: string;
  defaultTime?: string;
  excludeBookingId?: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [slots, setSlots] = useState<{ time: string }[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!optionId || !date) return setSlots(null);
    const ctrl = new AbortController();
    setSlots(null);
    setError(false);
    const qs = new URLSearchParams({ optionId, employeeId: employeeId || "any", date, ...(excludeBookingId ? { excludeBookingId } : {}) });
    fetch(`/api/admin/slots?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setSlots(d.slots))
      .catch((e) => e?.name !== "AbortError" && setError(true));
    return () => ctrl.abort();
  }, [optionId, employeeId, date, excludeBookingId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="date" className="label">
            Date
          </label>
          <input id="date" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="time" className="label">
            Time
          </label>
          <input id="time" name="time" type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} className="input" />
        </div>
      </div>
      {optionId && (
        <div>
          <p className="label">Free times {employeeId ? "" : "(anyone)"}</p>
          {error && <p className="text-sm text-danger">Could not load free times.</p>}
          {!error && slots === null && <p className="text-sm text-muted">Loading…</p>}
          {slots?.length === 0 && <p className="text-sm text-muted">No free times on this day — you can still type a time.</p>}
          {slots && slots.length > 0 && (
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  onClick={() => setTime(s.time)}
                  className={`min-h-11 border text-sm tabular-nums ${time === s.time ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-ink"}`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
