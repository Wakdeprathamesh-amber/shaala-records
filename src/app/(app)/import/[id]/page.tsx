import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { validateStaged } from "@/domain/import/commit";
import { batchById, stagedRowsFor } from "@/domain/import/repo";
import { commitImport } from "@/domain/import/actions";

export default async function ImportBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCtx();
  const { id } = await params;
  const t = await getT();

  const batch = await batchById(ctx, id);
  if (!batch) notFound();

  const staged = await stagedRowsFor(ctx, id);
  const validated = await validateStaged(ctx, staged);

  const bad = validated.filter((v) => Object.keys(v.errors).length > 0);
  const good = validated.length - bad.length;
  const updates = validated.filter((v) => v.existingStudentId && !Object.keys(v.errors).length).length;
  const inserts = good - updates;
  const committed = batch.status === "committed";

  const mapping = (batch.mappingJson ?? {}) as {
    columns?: Array<{ header: string; field: string | null; confidence: number }>;
  };
  const mapped = (mapping.columns ?? []).filter((c) => c.field);
  const ignored = (mapping.columns ?? []).filter((c) => !c.field);

  return (
    <>
      <PageHeader
        title={batch.filename}
        subtitle={`${validated.length} rows · ${batch.status}`}
        action={
          committed ? (
            <Link
              href="/students"
              className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-4
                         text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900"
            >
              {t("students.title")} →
            </Link>
          ) : (
            <form action={commitImport}>
              <input type="hidden" name="batchId" value={batch.id} />
              <button
                type="submit"
                disabled={good === 0}
                className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm font-medium text-white
                           disabled:opacity-50 dark:bg-slate-50 dark:text-slate-900"
              >
                {good} {t("action.confirm")}
              </button>
            </form>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="नवीन — New" value={inserts} />
        <Stat label="अद्ययावत — Update" value={updates} />
        <Stat label="त्रुटी — Errors" value={bad.length} tone={bad.length ? "bad" : "ok"} />
        <Stat label="एकूण — Total" value={validated.length} />
      </div>

      {updates > 0 && !committed ? (
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm
                      text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {updates} विद्यार्थी आधीच नोंदलेले आहेत — these GR numbers already exist and will be
          updated, not duplicated. Re-running an import is safe.
        </p>
      ) : null}

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
          ओळखलेले कॉलम — Detected columns
        </h2>
        <ul className="flex flex-wrap gap-2">
          {mapped.map((c) => (
            <li
              key={c.header}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"
            >
              <span className="text-slate-500 dark:text-slate-400">{c.header}</span>
              <span className="mx-1 text-slate-400">→</span>
              <span className="font-medium text-slate-900 dark:text-slate-50">{c.field}</span>
              {c.confidence < 0.85 ? <span className="ml-1 text-amber-600">?</span> : null}
            </li>
          ))}
        </ul>
        {ignored.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            दुर्लक्षित — ignored: {ignored.map((c) => c.header).filter(Boolean).join(", ")}
          </p>
        ) : null}
      </section>

      {bad.length > 0 ? (
        <section className="rounded-xl border border-red-200 bg-white p-4 dark:border-red-900 dark:bg-slate-900">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {bad.length} ओळींमध्ये त्रुटी — rows with errors (these will be skipped)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                  <th className="px-2 py-1.5 font-medium text-slate-500">ओळ</th>
                  <th className="px-2 py-1.5 font-medium text-slate-500">{t("students.gr")}</th>
                  <th className="px-2 py-1.5 font-medium text-slate-500">त्रुटी</th>
                </tr>
              </thead>
              <tbody>
                {bad.slice(0, 50).map((r) => (
                  <tr key={r.rowNumber} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                    <td className="px-2 py-1.5 tabular-nums">{r.rowNumber}</td>
                    <td className="px-2 py-1.5">{r.values.grNumber || "—"}</td>
                    <td className="px-2 py-1.5 text-red-700 dark:text-red-400">
                      {Object.entries(r.errors).map(([k, v]) => `${k}: ${v}`).join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bad.length > 50 ? (
            <p className="mt-2 text-xs text-slate-500">+{bad.length - 50} more</p>
          ) : null}
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
  value: number;
  tone?: "neutral" | "ok" | "bad";
}) {
  const colour = {
    neutral: "text-slate-900 dark:text-slate-50",
    ok: "text-emerald-600 dark:text-emerald-400",
    bad: "text-red-600 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${colour}`}>{value}</p>
    </div>
  );
}
