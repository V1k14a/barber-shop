"use client";

import { DateTime } from "luxon";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration, formatPrice } from "@/lib/format";

export interface CatalogOption {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceOre: number;
}
export interface CatalogEmployee {
  id: string;
  name: string;
  title: string;
  photoUrl: string | null;
}
export interface CatalogService {
  id: string;
  slug: string;
  name: string;
  description: string;
  options: CatalogOption[];
  employees: CatalogEmployee[];
}

interface Props {
  services: CatalogService[];
  timezone: string;
  today: string;
  lastDate: string;
  initial: { service?: string; option?: string; employee?: string };
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type Slot = { start: string; time: string };
type DayAvailability = { date: string; available: boolean };
type Confirmed = { startsAt: string; endsAt: string; employeeName: string; priceOre: number };

const ANY = "any";
const STEP_TITLES = ["Service", "Option", "Who", "Time", "Your details"];

export function BookingWizard({ services, timezone, today, lastDate, initial }: Props) {
  // Deep links like /booking?service=mens-haircut&option=…&employee=…
  const initService = services.find((s) => s.slug === initial.service || s.id === initial.service);
  const initOption = initService?.options.find((o) => o.id === initial.option);
  const initEmployee = initService?.employees.find((e) => e.id === initial.employee)?.id ?? (initial.employee === ANY ? ANY : undefined);

  const [serviceId, setServiceId] = useState<string | undefined>(initService?.id);
  const [optionId, setOptionId] = useState<string | undefined>(initOption?.id);
  const [employeeId, setEmployeeId] = useState<string | undefined>(initEmployee);
  const [date, setDate] = useState<string | undefined>();
  const [slot, setSlot] = useState<Slot | undefined>();
  const [step, setStep] = useState<Step>(!initService ? 1 : !initOption ? 2 : !initEmployee ? 3 : 4);
  const [notice, setNotice] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState<Confirmed | undefined>();

  const service = services.find((s) => s.id === serviceId);
  const option = service?.options.find((o) => o.id === optionId);
  const employee = service?.employees.find((e) => e.id === employeeId);

  const topRef = useRef<HTMLDivElement>(null);
  const go = useCallback((next: Step) => {
    setStep(next);
    setNotice(undefined);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (services.length === 0) {
    return <p className="mt-8 text-muted">Online booking is not available right now. Please call the salon.</p>;
  }

  if (step === 6 && confirmed && service && option) {
    return <Confirmation confirmed={confirmed} serviceName={service.name} optionName={option.name} timezone={timezone} />;
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      <Progress step={step} />

      <Summary
        items={[
          service && { label: service.name, step: 1 as Step },
          option && step > 2 && { label: `${option.name} · ${formatDuration(option.durationMin)} · ${formatPrice(option.priceOre)}`, step: 2 as Step },
          employeeId && step > 3 && { label: employee ? employee.name : "No preference", step: 3 as Step },
          slot && date && step > 4 && { label: formatDateTime(slot.start, timezone), step: 4 as Step },
        ]}
        current={step}
        onEdit={go}
      />

      {notice && (
        <div role="alert" className="mt-6 border border-danger/30 bg-danger/5 px-4 py-3 text-danger">
          {notice}
        </div>
      )}

      <div className="mt-8">
        {step === 1 && (
          <StepList heading="Choose a service">
            {services.map((s) => (
              <ChoiceButton
                key={s.id}
                selected={s.id === serviceId}
                title={s.name}
                subtitle={s.description}
                meta={`from ${formatPrice(Math.min(...s.options.map((o) => o.priceOre)))}`}
                onClick={() => {
                  if (s.id !== serviceId) {
                    setOptionId(undefined);
                    setEmployeeId(undefined);
                    setSlot(undefined);
                  }
                  setServiceId(s.id);
                  go(2);
                }}
              />
            ))}
          </StepList>
        )}

        {step === 2 && service && (
          <StepList heading={`${service.name}: choose an option`} onBack={() => go(1)}>
            {service.options.map((o) => (
              <ChoiceButton
                key={o.id}
                selected={o.id === optionId}
                title={o.name}
                subtitle={o.description}
                meta={`${formatDuration(o.durationMin)} · ${formatPrice(o.priceOre)}`}
                onClick={() => {
                  if (o.id !== optionId) setSlot(undefined);
                  setOptionId(o.id);
                  // Employee already chosen (e.g. "Book with Sofie" from the team page) → straight to times.
                  go(employeeId ? 4 : 3);
                }}
              />
            ))}
          </StepList>
        )}

        {step === 3 && service && (
          <StepList heading="Who would you like?" onBack={() => go(2)}>
            {service.employees.length > 1 && (
              <ChoiceButton
                selected={employeeId === ANY}
                title="No preference"
                subtitle="Most available times — we'll pick a free specialist"
                avatar={<Avatar name="?" />}
                onClick={() => {
                  if (employeeId !== ANY) setSlot(undefined);
                  setEmployeeId(ANY);
                  go(4);
                }}
              />
            )}
            {service.employees.map((e) => (
              <ChoiceButton
                key={e.id}
                selected={e.id === employeeId}
                title={e.name}
                subtitle={e.title}
                avatar={<Avatar name={e.name} photoUrl={e.photoUrl} />}
                onClick={() => {
                  if (e.id !== employeeId) setSlot(undefined);
                  setEmployeeId(e.id);
                  go(4);
                }}
              />
            ))}
          </StepList>
        )}

        {step === 4 && option && employeeId && (
          <TimeStep
            optionId={option.id}
            employeeId={employeeId}
            timezone={timezone}
            today={today}
            lastDate={lastDate}
            date={date}
            slot={slot}
            onDate={(d) => {
              setDate(d);
              setSlot(undefined);
            }}
            onSlot={(s) => {
              setSlot(s);
              go(5);
            }}
            onBack={() => go(3)}
          />
        )}

        {step === 5 && service && option && employeeId && slot && (
          <DetailsStep
            optionId={option.id}
            employeeId={employeeId}
            slot={slot}
            onBack={() => go(4)}
            onConflict={(message) => {
              setSlot(undefined);
              go(4);
              setNotice(message);
            }}
            onConfirmed={(c) => {
              setConfirmed(c);
              go(6);
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Progress({ step }: { step: Step }) {
  const current = Math.min(step, 5);
  return (
    <div className="mt-6" aria-label={`Step ${current} of 5: ${STEP_TITLES[current - 1]}`}>
      <div className="flex gap-1.5">
        {STEP_TITLES.map((t, i) => (
          <div key={t} className={`h-1 flex-1 ${i < current ? "bg-ink" : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        Step {current} of 5 · {STEP_TITLES[current - 1]}
      </p>
    </div>
  );
}

function Summary({
  items,
  current,
  onEdit,
}: {
  items: (false | undefined | "" | { label: string; step: Step })[];
  current: Step;
  onEdit: (s: Step) => void;
}) {
  const visible = items.filter((i): i is { label: string; step: Step } => !!i && i.step < current);
  if (visible.length === 0) return null;
  return (
    <ul className="mt-5 flex flex-wrap gap-2">
      {visible.map((i) => (
        <li key={i.step}>
          <button
            type="button"
            onClick={() => onEdit(i.step)}
            className="flex items-center gap-2 border border-line bg-white px-3 py-1.5 text-sm hover:border-ink"
            aria-label={`Change: ${i.label}`}
          >
            {i.label}
            <span className="text-muted" aria-hidden>
              ✎
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function StepList({ heading, onBack, children }: { heading: string; onBack?: () => void; children: React.ReactNode }) {
  return (
    <section>
      <StepHeading heading={heading} onBack={onBack} />
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function StepHeading({ heading, onBack }: { heading: string; onBack?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-xl font-normal">{heading}</h2>
      {onBack && (
        <button type="button" onClick={onBack} className="shrink-0 py-2 text-sm text-muted underline-offset-4 hover:underline">
          ← Back
        </button>
      )}
    </div>
  );
}

function ChoiceButton({
  title,
  subtitle,
  meta,
  avatar,
  selected,
  onClick,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  avatar?: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-4 border bg-white px-4 py-4 text-left transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:px-5 ${
        selected ? "border-ink" : "border-line"
      }`}
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block text-lg">{title}</span>
        {subtitle && <span className="mt-0.5 block text-sm text-muted">{subtitle}</span>}
      </span>
      {meta && <span className="shrink-0 text-right text-sm whitespace-nowrap">{meta}</span>}
      <span aria-hidden className="text-muted">
        →
      </span>
    </button>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />;
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sand text-sm tracking-widest">
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------------ */

function TimeStep({
  optionId,
  employeeId,
  timezone,
  today,
  lastDate,
  date,
  slot,
  onDate,
  onSlot,
  onBack,
}: {
  optionId: string;
  employeeId: string;
  timezone: string;
  today: string;
  lastDate: string;
  date?: string;
  slot?: Slot;
  onDate: (d: string) => void;
  onSlot: (s: Slot) => void;
  onBack: () => void;
}) {
  const [weekStart, setWeekStart] = useState(() => (date && date >= today ? startOfStrip(date, today, timezone) : today));
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string>();

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i, timezone)).filter((d) => d <= lastDate),
    [weekStart, timezone, lastDate],
  );
  const canPrev = weekStart > today;
  const canNext = addDays(weekStart, 7, timezone) <= lastDate;

  // Availability for the visible week.
  useEffect(() => {
    const ctrl = new AbortController();
    setDays(null);
    const qs = new URLSearchParams({ optionId, employeeId, from: weekStart, days: String(weekDates.length) });
    fetch(`/api/availability?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { days: DayAvailability[] }) => {
        setDays(data.days);
        // Pick the first free day of the week if nothing (valid) is selected yet.
        if (!date || !data.days.some((d) => d.date === date)) {
          const first = data.days.find((d) => d.available);
          if (first) onDate(first.date);
        }
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError("Could not load available days. Please try again.");
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `date`/`onDate` intentionally excluded: only refetch when the week changes
  }, [optionId, employeeId, weekStart, weekDates.length]);

  // Slots for the selected day.
  useEffect(() => {
    if (!date) return;
    const ctrl = new AbortController();
    setSlots(null);
    setError(undefined);
    const qs = new URLSearchParams({ optionId, employeeId, date });
    fetch(`/api/slots?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { slots: Slot[] }) => setSlots(data.slots))
      .catch((e) => {
        if (e?.name !== "AbortError") setError("Could not load available times. Please try again.");
      });
    return () => ctrl.abort();
  }, [optionId, employeeId, date]);

  const selectedInWeek = date && weekDates.includes(date);
  const noneThisWeek = days !== null && !days.some((d) => d.available);

  const groups = useMemo(() => {
    const g = { Morning: [] as Slot[], Afternoon: [] as Slot[], Evening: [] as Slot[] };
    for (const s of slots ?? []) {
      const h = Number(s.time.slice(0, 2));
      (h < 12 ? g.Morning : h < 17 ? g.Afternoon : g.Evening).push(s);
    }
    return Object.entries(g).filter(([, list]) => list.length > 0);
  }, [slots]);

  return (
    <section>
      <StepHeading heading="Choose a date and time" onBack={onBack} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setWeekStart(maxDate(today, addDays(weekStart, -7, timezone)))}
          className="px-2 py-2 text-sm disabled:opacity-30"
          aria-label="Previous week"
        >
          ← Earlier
        </button>
        <span className="text-sm text-muted">{monthLabel(weekDates, timezone)}</span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setWeekStart(addDays(weekStart, 7, timezone))}
          className="px-2 py-2 text-sm disabled:opacity-30"
          aria-label="Next week"
        >
          Later →
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Date">
        {weekDates.map((d) => {
          const info = days?.find((x) => x.date === d);
          const available = info?.available ?? false;
          const dt = DateTime.fromISO(d, { zone: timezone });
          const selected = d === date;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!available}
              onClick={() => onDate(d)}
              aria-label={`${dt.toFormat("cccc d LLLL")}${available ? "" : ", fully booked or closed"}`}
              className={`flex flex-col items-center border py-2.5 transition ${
                selected
                  ? "border-ink bg-ink text-paper"
                  : available
                    ? "border-line bg-white hover:border-ink"
                    : "border-transparent text-muted/50 line-through decoration-1"
              } ${days === null ? "animate-pulse" : ""}`}
            >
              <span className="text-[0.7rem] tracking-wider uppercase">{dt.toFormat("ccc")}</span>
              <span className="text-lg">{dt.toFormat("d")}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8" aria-live="polite">
        {error && <p className="text-danger">{error}</p>}
        {!error && noneThisWeek && (
          <div className="border border-line bg-white p-5 text-center">
            <p>No free times this week.</p>
            {canNext && (
              <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7, timezone))} className="mt-3 underline underline-offset-4">
                Show next week →
              </button>
            )}
          </div>
        )}
        {!error && !noneThisWeek && selectedInWeek && slots === null && <p className="text-muted">Loading times…</p>}
        {!error && !noneThisWeek && selectedInWeek && slots?.length === 0 && (
          <p className="text-muted">No free times on this day. Please choose another day.</p>
        )}
        {!error &&
          selectedInWeek &&
          groups.map(([label, list]) => (
            <div key={label} className="mb-6">
              <p className="eyebrow mb-2">{label}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {list.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => onSlot(s)}
                    aria-pressed={slot?.start === s.start}
                    className={`border py-3 text-center text-lg tabular-nums transition hover:border-ink ${
                      slot?.start === s.start ? "border-ink bg-ink text-paper" : "border-line bg-white"
                    }`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function DetailsStep({
  optionId,
  employeeId,
  slot,
  onBack,
  onConflict,
  onConfirmed,
}: {
  optionId: string;
  employeeId: string;
  slot: Slot;
  onBack: () => void;
  onConflict: (message: string) => void;
  onConfirmed: (c: Confirmed) => void;
}) {
  const [values, setValues] = useState({ customerName: "", customerPhone: "", customerEmail: "", note: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(undefined);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, optionId, employeeId, startsAt: slot.start }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return onConfirmed(data.booking);
      if (res.status === 409 || data.code === "OUTSIDE_BOOKING_WINDOW") return onConflict(data.error);
      setErrors(data.fields ?? {});
      setFormError(data.error ?? "Something went wrong. Please try again.");
    } catch {
      setFormError("Could not reach the salon. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <StepHeading heading="Your details" onBack={onBack} />
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Full name" name="customerName" autoComplete="name" value={values.customerName} onChange={set("customerName")} error={errors.customerName} required />
        <Field label="Phone" name="customerPhone" type="tel" autoComplete="tel" inputMode="tel" value={values.customerPhone} onChange={set("customerPhone")} error={errors.customerPhone} required />
        <Field label="E-mail" name="customerEmail" type="email" autoComplete="email" inputMode="email" value={values.customerEmail} onChange={set("customerEmail")} error={errors.customerEmail} hint="We'll send your confirmation here." required />
        <div>
          <label htmlFor="note" className="mb-1.5 block text-sm">
            Note <span className="text-muted">(optional)</span>
          </label>
          <textarea id="note" name="note" rows={3} maxLength={500} value={values.note} onChange={set("note")} className="w-full border border-line bg-white px-4 py-3 text-base focus:border-ink focus:outline-none" />
        </div>
        {/* Honeypot: hidden from people, tempting for bots */}
        <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
          <label>
            Website <input tabIndex={-1} autoComplete="off" name="website" value={values.website} onChange={set("website")} />
          </label>
        </div>

        {formError && (
          <p role="alert" className="text-danger">
            {formError}
          </p>
        )}

        <button type="submit" disabled={submitting} className="w-full bg-ink py-4 text-lg tracking-wide text-paper transition hover:bg-ink/85 disabled:opacity-60">
          {submitting ? "Booking…" : "Confirm booking"}
        </button>
        <p className="text-center text-sm text-muted">Free cancellation via the link in your confirmation e-mail.</p>
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  ...input
}: { label: string; name: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`w-full border bg-white px-4 py-3 text-base focus:outline-none ${error ? "border-danger" : "border-line focus:border-ink"}`}
        {...input}
      />
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Confirmation({ confirmed, serviceName, optionName, timezone }: { confirmed: Confirmed; serviceName: string; optionName: string; timezone: string }) {
  const start = DateTime.fromISO(confirmed.startsAt, { zone: timezone });
  const end = DateTime.fromISO(confirmed.endsAt, { zone: timezone });
  return (
    <section className="mt-8 border border-line bg-white p-6 sm:p-8" aria-live="polite">
      <p className="eyebrow text-success">Booking confirmed</p>
      <h2 className="mt-2 text-2xl font-light">See you {start.toFormat("cccc d LLLL")}!</h2>
      <dl className="mt-6 divide-y divide-line border-y border-line">
        <Row label="Service" value={`${serviceName} — ${optionName}`} />
        <Row label="When" value={`${start.toFormat("cccc d LLLL yyyy")}, ${start.toFormat("HH:mm")}–${end.toFormat("HH:mm")}`} />
        <Row label="With" value={confirmed.employeeName} />
        <Row label="Price" value={formatPrice(confirmed.priceOre)} />
      </dl>
      <p className="mt-6 text-muted">
        A confirmation e-mail is on its way. Need to cancel? Use the link in the e-mail (up to 24 hours before) or call the salon.
      </p>
      <Link href="/" className="mt-6 inline-block underline underline-offset-4">
        Back to the homepage
      </Link>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function addDays(date: string, n: number, zone: string) {
  return DateTime.fromISO(date, { zone }).plus({ days: n }).toISODate()!;
}
function maxDate(a: string, b: string) {
  return a > b ? a : b;
}
/** Week strip containing `date`, starting today or in 7-day steps after it. */
function startOfStrip(date: string, today: string, zone: string) {
  const diff = Math.floor(DateTime.fromISO(date, { zone }).diff(DateTime.fromISO(today, { zone }), "days").days);
  return addDays(today, Math.floor(diff / 7) * 7, zone);
}
function monthLabel(dates: string[], zone: string) {
  if (dates.length === 0) return "";
  const a = DateTime.fromISO(dates[0], { zone });
  const b = DateTime.fromISO(dates[dates.length - 1], { zone });
  return a.month === b.month ? a.toFormat("LLLL yyyy") : `${a.toFormat("LLL")} – ${b.toFormat("LLL yyyy")}`;
}
function formatDateTime(iso: string, zone: string) {
  return DateTime.fromISO(iso, { zone }).toFormat("ccc d LLL, HH:mm");
}
