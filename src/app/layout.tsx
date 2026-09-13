import type { Metadata, Viewport } from "next";

import { getLocale } from "@/lib/i18n/server";
import { getTheme } from "@/lib/theme/server";
import { SYSTEM_THEME_SCRIPT } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "शाळा रेकॉर्ड्स — Shaala Records",
    template: "%s · Shaala Records",
  },
  description:
    "Maharashtra school General Register, statutory documents and government exports",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The clerk zooms in to check a GR number against a paper register.
  // Never disable that.
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);

  return (
    <html
      lang={locale}
      className={`h-full antialiased${theme === "dark" ? " dark" : ""}`}
      // "system" decides on the client before paint; light and dark are
      // settled on the server so there is nothing to flash.
      suppressHydrationWarning
    >
      <head>
        {theme === "system" ? (
          <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
        ) : null}
      </head>
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        {children}
      </body>
    </html>
  );
}
