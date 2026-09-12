import mr from "./mr.json";
import en from "./en.json";

export const LOCALE_COOKIE = "shaala_locale";

export type Locale = "mr" | "en";

/** Keys come from mr.json, which is the source of truth. A key present in
 *  en.json but not mr.json is a type error; the reverse is caught by
 *  tests/unit/i18n.test.ts. */
export type MessageKey = keyof typeof mr;

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = {
  mr: mr as Record<MessageKey, string>,
  en: en as Record<MessageKey, string>,
};

export const DEFAULT_LOCALE: Locale = "mr";

export function isLocale(value: unknown): value is Locale {
  return value === "mr" || value === "en";
}

/**
 * Returns a translator bound to one locale.
 *
 * Marathi is the default rather than English because the register is kept in
 * Marathi and the clerk reads Marathi — English is the fallback for the
 * occasional administrator, not the other way round.
 */
export function translator(locale: Locale) {
  const dict = DICTIONARIES[locale];
  return function t(key: MessageKey): string {
    // A missing key returns the key itself, which is ugly on screen and so
    // gets noticed, rather than rendering an empty space that does not.
    return dict[key] ?? key;
  };
}

export type T = ReturnType<typeof translator>;

/** The other script, for the language toggle. */
export function otherLocale(locale: Locale): Locale {
  return locale === "mr" ? "en" : "mr";
}

export const LOCALE_LABEL: Record<Locale, string> = {
  mr: "मराठी",
  en: "English",
};
