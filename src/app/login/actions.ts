"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createSessionCookie, deleteSessionCookie } from "@/lib/session";

/** Constant-time string comparison (hashes first to equalize lengths). */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/** Sets the session cookie and redirects home when the password matches APP_PASSWORD. */
export async function login(formData: FormData) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) throw new Error("APP_PASSWORD is not set");

  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, appPassword)) {
    redirect("/login?error=1");
  }

  await createSessionCookie();
  redirect("/todos");
}

/** Clears the session cookie and returns to the login screen. */
export async function logout() {
  await deleteSessionCookie();
  redirect("/login");
}
