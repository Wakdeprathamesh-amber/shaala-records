import "server-only";

import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, translator, type Locale } from ".";

/**
 * Resolves the UI language.
 *
 * Cookie first — an explicit choice always wins. With no cookie, the browser's
 * own language decides. Without this, Chrome on an English-locale machine
 * machine-translates the Marathi UI and the clerk sees "Uploaded by Govt"
 * instead of our own "Government upload" — worse copy than we ship, and no
 * hint that a proper English mode exists one click away.
 */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const chosen = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const accept = (await headers()).get("accept-language") ?? "";
  // "mr" anywhere in the list beats a leading "en": a Marathi speaker on an
  // English-default Android phone usually has both, and wants Marathi.
  if (/\bmr\b/i.test(accept)) return "mr";
  if (/^\s*en\b/i.test(accept)) return "en";
  return DEFAULT_LOCALE;
}

export async function getT() {
  return translator(await getLocale());
}
