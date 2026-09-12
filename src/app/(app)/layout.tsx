import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { NAV } from "@/lib/nav";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { translator } from "@/lib/i18n";

import { setLocale, signOut } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // proxy.ts already bounced anyone without a cookie, but that check is
  // optimistic by design — this is where an invalid or expired session is
  // actually caught.
  if (!session) redirect("/login");

  const locale = await getLocale();
  const t = translator(locale);

  const labels = Object.fromEntries(
    NAV.map((item) => [item.href, t(item.labelKey)]),
  );

  return (
    <AppShell
      labels={labels}
      locale={locale}
      schoolName={session.schoolNameMr}
      userName={session.name}
      appName={t("app.name")}
      tagline={t("app.tagline")}
      menuLabel={t("nav.menu")}
      signOutLabel={t("action.signOut")}
      signOutAction={signOut}
      setLocaleAction={setLocale}
    >
      {children}
    </AppShell>
  );
}
