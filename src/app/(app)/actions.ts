"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { destroySession } from "@/lib/auth/session";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";

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
