"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { destroySession } from "@/lib/auth/session";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { THEME_COOKIE, isTheme } from "@/lib/theme";

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export async function setLocale(formData: FormData) {
  const next = formData.get("locale");
  if (!isLocale(next)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, next, {
    httpOnly: false, // read only by the server, but harmless to the client
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

export async function setTheme(formData: FormData) {
  const next = formData.get("theme");
  if (!isTheme(next)) return;

  const jar = await cookies();
  jar.set(THEME_COOKIE, next, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
