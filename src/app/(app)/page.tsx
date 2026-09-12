import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/lib/auth/session";
import { getDashboardSummary } from "@/domain/dashboard/repo";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";

export default async function DashboardPage() {
  const ctx = await requireCtx();
  const t = await getT();
  const summary = await getDashboardSummary(ctx);

  return (
    <>
      <PageHeader title={t("nav.dashboard")} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("dash.students")} value={summary.studentCount} />
        <StatCard label={t("dash.docsThisMonth")} value={summary.documentsThisMonth} />
        <StatCard
          label={t("dash.exportBlocked")}
          value={summary.exportBlocked}
          tone={summary.exportBlocked > 0 ? "warn" : "ok"}
          href="/exports"
        />
        <StatCard
          label={t("dash.daysToDeadline")}
          value={summary.daysToDeadline}
          tone={summary.daysToDeadline <= 30 ? "warn" : "neutral"}
        />
      </div>
    </>
  );
}
