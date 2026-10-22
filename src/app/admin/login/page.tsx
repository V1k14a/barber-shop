import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { login } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Staff login", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  if ((await auth())?.user) redirect("/admin/calendar");
  const { callbackUrl } = await searchParams;
  let callbackPath = "";
  try {
    callbackPath = callbackUrl ? new URL(callbackUrl, "http://x").pathname : "";
  } catch {}

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <Image src="/logo.png" alt="Salon de Choix" width={497} height={120} className="mx-auto h-9 w-auto" priority />
        <h1 className="mt-8 text-center text-2xl font-light">Staff login</h1>
        <ActionForm action={login} className="mt-8 space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackPath} />
          <div>
            <label htmlFor="email" className="label">
              E-mail
            </label>
            <input id="email" name="email" type="email" autoComplete="username" required className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton className="btn btn-primary w-full" pendingText="Signing in…">
            Sign in
          </SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
