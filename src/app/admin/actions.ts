"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import type { ActionState } from "@/lib/admin/action";

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const callback = String(fd.get("callbackUrl") ?? "");
  // Only allow redirects within the admin area.
  const redirectTo = callback.startsWith("/admin") && !callback.startsWith("//") ? callback : "/admin/calendar";
  try {
    await signIn("credentials", {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      redirectTo,
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Wrong e-mail or password (or too many attempts — wait 15 minutes)." };
    throw e;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/admin/login" });
}
