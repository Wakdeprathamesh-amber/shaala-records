import type { Metadata, Viewport } from "next";

import { getLocale } from "@/lib/i18n/server";

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
  const locale = await getLocale();

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
