"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/admin/action";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Form wired to a server action, showing success / error messages and
 * per-field errors (rendered by <FieldError name="…" />, via data attributes).
 */
export function ActionForm({
  action,
  children,
  className = "",
  confirm,
  resetOnSuccess = false,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  /** Ask before submitting (e.g. "Cancel this booking?") */
  confirm?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  // Show field errors next to the inputs.
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    form.querySelectorAll<HTMLElement>("[data-field-error]").forEach((el) => {
      const msg = state?.fields?.[el.dataset.fieldError!];
      el.textContent = msg ?? "";
      el.hidden = !msg;
    });
    if (state?.ok && resetOnSuccess) form.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        // Submit manually instead of <form action>: React 19 resets forms after an
        // action, which would wipe what staff typed when validation fails.
        e.preventDefault();
        if (pending) return;
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state?.error && (
        <p role="alert" className="mt-4 border border-danger/30 bg-danger/5 px-4 py-3 text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="mt-4 border border-success/30 bg-success/5 px-4 py-3 text-success">
          {state.ok}
        </p>
      )}
    </form>
  );
}

const PendingContext = createContext(false);

export function FieldError({ name }: { name: string }) {
  return <p data-field-error={name} hidden className="mt-1 text-sm text-danger" />;
}

export function SubmitButton({ children, className = "btn btn-primary", pendingText = "Saving…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
