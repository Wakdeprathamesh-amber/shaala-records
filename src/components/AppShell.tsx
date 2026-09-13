"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LOCALE_LABEL, otherLocale, type Locale } from "@/lib/i18n";
import { THEME_LABEL, nextTheme, type Theme } from "@/lib/theme";
import { NAV } from "@/lib/nav";

/** Every interactive element is at least 44px tall. The clerk may be using a
 *  cheap Android phone with a cracked screen; nothing here is hover-only. */
const TAP = "min-h-[44px]";

function NavLinks({
  labels,
  onNavigate,
}: {
  labels: Record<string, string>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`${TAP} flex items-center gap-3 rounded-lg px-3 text-sm transition
              ${
                active
                  ? "bg-slate-900 font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
          >
            <span aria-hidden className="w-4 text-center opacity-70">
              {item.icon}
            </span>
            {labels[item.href]}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  labels,
  locale,
  schoolName,
  userName,
  appName,
  tagline,
  menuLabel,
  signOutLabel,
  signOutAction,
  setLocaleAction,
  theme,
  setThemeAction,
}: {
  children: React.ReactNode;
  labels: Record<string, string>;
  locale: Locale;
  schoolName: string;
  userName: string;
  appName: string;
  tagline: string;
  menuLabel: string;
  signOutLabel: string;
  signOutAction: () => Promise<void>;
  setLocaleAction: (formData: FormData) => Promise<void>;
  theme: Theme;
  setThemeAction: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the sheet on navigation, and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const brand = (
    <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
      <p className="text-base font-semibold text-slate-900 dark:text-slate-50">{appName}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{schoolName}</p>
    </div>
  );

  const footer = (
    <div className="mt-auto border-t border-slate-200 p-3 dark:border-slate-800">
      <p className="px-3 pb-2 text-xs text-slate-500 dark:text-slate-400">{userName}</p>
      <form action={setLocaleAction}>
        <input type="hidden" name="locale" value={otherLocale(locale)} />
        <button
          type="submit"
          className={`${TAP} w-full rounded-lg px-3 text-left text-sm text-slate-700
                      hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        >
          <span aria-hidden className="mr-3 opacity-70">⇄</span>
          {LOCALE_LABEL[otherLocale(locale)]}
        </button>
      </form>
      <form action={setThemeAction}>
        <input type="hidden" name="theme" value={nextTheme(theme)} />
        <button
          type="submit"
          title={THEME_LABEL[nextTheme(theme)][locale]}
          className={`${TAP} w-full rounded-lg px-3 text-left text-sm text-slate-700
                      hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        >
          <span aria-hidden className="mr-3 opacity-70">{THEME_LABEL[theme].icon}</span>
          {THEME_LABEL[theme][locale]}
          <span className="ml-1 text-xs text-slate-400">→ {THEME_LABEL[nextTheme(theme)][locale]}</span>
        </button>
      </form>
      <form action={signOutAction}>
        <button
          type="submit"
          className={`${TAP} w-full rounded-lg px-3 text-left text-sm text-slate-700
                      hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        >
          <span aria-hidden className="mr-3 opacity-70">⏻</span>
          {signOutLabel}
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar — fixed, 240px */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200
                   bg-white lg:flex dark:border-slate-800 dark:bg-slate-900"
      >
        {brand}
        <NavLinks labels={labels} />
        {footer}
      </aside>

      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200
                   bg-white px-3 py-2 lg:hidden dark:border-slate-800 dark:bg-slate-900"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={menuLabel}
          aria-expanded={open}
          className={`${TAP} min-w-[44px] rounded-lg text-xl text-slate-700
                      hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800`}
        >
          ☰
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
            {appName}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{tagline}</p>
        </div>
      </header>

      {/* Mobile slide-over */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/50"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col
                       bg-white shadow-xl dark:bg-slate-900"
          >
            {brand}
            <NavLinks labels={labels} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      ) : null}

      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
