"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cancelByToken } from "./actions";

export function CancelForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(cancelByToken, undefined);
  if (state?.done) {
    return (
      <div role="status" className="mt-8">
        <p className="text-lg text-success">Your booking has been cancelled.</p>
        <p className="mt-2 text-muted">You&apos;ll receive a confirmation by e-mail.</p>
        <Link href="/booking" className="mt-6 inline-block bg-ink px-8 py-4 text-paper">
          Book a new time
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="mt-8">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <p role="alert" className="mb-4 text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="w-full border border-danger py-4 text-lg text-danger transition hover:bg-danger hover:text-white disabled:opacity-50 sm:w-auto sm:px-10">
        {pending ? "Cancelling…" : "Yes, cancel my booking"}
      </button>
      <p className="mt-4">
        <Link href="/" className="underline underline-offset-4">
          No, keep it
        </Link>
      </p>
    </form>
  );
}
