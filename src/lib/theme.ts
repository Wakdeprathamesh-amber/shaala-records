export const THEME_COOKIE = "shaala_theme";

export type Theme = "light" | "dark" | "system";

export function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark" || v === "system";
}

export const DEFAULT_THEME: Theme = "light";

/** Cycle order for a single toggle button. */
export function nextTheme(t: Theme): Theme {
  return t === "light" ? "dark" : t === "dark" ? "system" : "light";
}

export const THEME_LABEL: Record<Theme, { mr: string; en: string; icon: string }> = {
  light: { mr: "उजळ", en: "Light", icon: "☀" },
  dark: { mr: "गडद", en: "Dark", icon: "☾" },
  system: { mr: "सिस्टम", en: "System", icon: "◐" },
};

/**
 * Runs before paint when the theme is "system", so the first frame is already
 * the right colour. Inlined in <head> by the root layout. Kept dependency-free
 * and tiny on purpose.
 */
export const SYSTEM_THEME_SCRIPT = `(function(){try{if(matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.classList.add("dark")}}catch(e){}})();`;
