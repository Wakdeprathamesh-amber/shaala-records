import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { loadTemplate, listTemplates } from "@/domain/exports/mapper";
import { rowsForExport, recentRuns, currentYearLabel } from "@/domain/exports/repo";
import { summarise, validateForExport } from "@/domain/exports/validate";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

export const metadata = { title: "शासकीय अपलोड — Government upload" };

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const ctx = await requireCtx();
  const t = await getT();
  const { template: templateId } = await searchParams;

  const template = loadTemplate(templateId ?? listTemplates()[0].id);
  const [rows, runs, yearLabel] = await Promise.all([
    rowsForExport(ctx),
    recentRuns(ctx, 5),
    currentYearLabel(ctx),
  ]);

  const summary = summarise(validateForExport(rows, template));

  return (
    <>
      <PageHeader
        title={t("export.title")}
        subtitle={`${template.label}${yearLabel ? ` · ${yearLabel}` : ""}`}
        action={
          summary.blocked ? (
            <span
              className="inline-flex min-h-[44px] cursor-not-allowed items-center rounded-lg
                         bg-slate-200 px-4 text-sm font-medium text-slate-500
                         dark:bg-slate-800 dark:text-slate-500"
              title={t("export.blocked")}
            >
              {t("export.generate")}
            </span>
          ) : (
            <a
              href={`/api/exports/file?template=${template.id}`}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-4
                         text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900"
            >
              {t("export.generate")}
            </a>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("dash.students")} value={rows.length} />
        <Stat label="त्रुटी — Errors" value={summary.errorCount} tone={summary.errorCount ? "bad" : "ok"} />
        <Stat label="सूचना — Warnings" value={summary.warningCount} tone={summary.warningCount ? "warn" : "ok"} />
        <Stat
          label={summary.blocked ? t("export.blocked") : t("export.ready")}
          value={summary.blocked ? `${summary.affectedStudents}` : "✓"}
          tone={summary.blocked ? "bad" : "ok"}
        />
      </div>

      {summary.blocked ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm
                      text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {summary.errorCount} त्रुटी दुरुस्त केल्याशिवाय फाइल तयार होणार नाही.
          {" "}Fix the errors below; warnings do not block the upload.
        </p>
      ) : (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm
                      text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          सर्व {rows.length} विद्यार्थ्यांची माहिती पूर्ण आहे — all {rows.length} students are ready to upload.
        </p>
      )}

      {summary.groups.length > 0 ? (
        <ul className="grid gap-3">
          {summary.groups.map((g) => (
            <li
              key={g.groupKey}
              className={`rounded-xl border p-4 ${
                g.severity === "error"
                  ? "border-red-200 bg-white dark:border-red-900 dark:bg-slate-900"
                  : "border-amber-200 bg-white dark:border-amber-900 dark:bg-slate-900"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {g.field}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    g.severity === "error"
                      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {g.count} {g.severity === "error" ? "त्रुटी" : "सूचना"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{g.message}</p>

              <ul className="mt-3 flex flex-wrap gap-2">
                {g.rows.slice(0, 40).map((r) => (
                  <li key={`${g.groupKey}-${r.studentId}`}>
                    <Link
                      href={`/students/${r.studentId}/edit`}
                      className="inline-flex min-h-[36px] items-center rounded-lg border
                                 border-slate-200 px-2.5 text-xs text-slate-700 hover:bg-slate-100
                                 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {r.studentName}
                      <span className="ml-1.5 text-slate-400">
                        {toDevanagariDigits(r.grNumber)}
                      </span>
                    </Link>
                  </li>
                ))}
                {g.rows.length > 40 ? (
                  <li className="self-center text-xs text-slate-500">
                    +{g.rows.length - 40} more
                  </li>
                ) : null}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}

      {runs.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
            मागील फाइल्स — Previous files
          </h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white
                         dark:divide-slate-800/60 dark:border-slate-800 dark:bg-slate-900">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-slate-900 dark:text-slate-50">{r.templateVersion}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {r.generatedAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const colour = {
    neutral: "text-slate-900 dark:text-slate-50",
    ok: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad: "text-red-600 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${colour}`}>{value}</p>
    </div>
  );
}
