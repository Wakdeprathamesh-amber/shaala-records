import type { MessageKey } from "@/lib/i18n";

export type NavItem = { href: string; labelKey: MessageKey; icon: string };

/**
 * Lives here rather than in AppShell.tsx because both a Server Component (the
 * layout, which resolves the labels) and a Client Component (the shell, which
 * renders them) need it. A value imported from a "use client" module into a
 * Server Component arrives as a client-reference proxy, not the real array —
 * so shared data must sit in a module that declares neither.
 */
export const NAV: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: "▦" },
  { href: "/students", labelKey: "nav.students", icon: "☰" },
  { href: "/documents", labelKey: "nav.documents", icon: "▤" },
  { href: "/exports", labelKey: "nav.exports", icon: "↑" },
  { href: "/import", labelKey: "nav.import", icon: "↓" },
  { href: "/reports", labelKey: "nav.reports", icon: "▥" },
  { href: "/settings", labelKey: "nav.settings", icon: "⚙" },
];
