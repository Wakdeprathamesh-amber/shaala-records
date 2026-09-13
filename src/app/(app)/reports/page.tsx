import { PageHeader } from "@/components/PageHeader";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { demographicCells } from "@/domain/reports/repo";
import { buildDemographicTable } from "@/domain/reports/pivot";
import { school as loadSchool } from "@/domain/settings/repo";
import { currentYearLabel } from "@/domain/exports/repo";
import { CATEGORY_LABEL } from "@/domain/students/schema";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

export const metadata = { title: "अहवाल — Reports" };

export default async function ReportsPage() {
  const ctx = await requireCtx();
  const t = await getT();
  const [cells, school, yearLabel] = await Promise.all([
    demographicCells(ctx),
    loadSchool(ctx),
    currentYearLabel(ctx),
  ]);
  const table = buildDemographicTable(cells);
  const rows = table.unknown ? [...table.rows, table.unknown] : table.rows;
  const d = (n: number) => (n === 0 ? "–" : n);

  return (
    <>
      <PageHeader
        title={t("report.demographic")}
        subtitle={`${t("report.inspection")} ${yearLabel ?? "—"} · ${school?.nameMr ?? ""}`}
        action={
          <a
            href="/api/reports/demographic/pdf"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-4
                       text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900"
          >
            {t("report.print")}
          </a>
        }
      />

      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        सध्या शिकत असलेले विद्यार्थी, प्रवर्ग × इयत्ता × लिंग. एकूण{" "}
        <span className="font-semibold text-slate-900 dark:text-slate-50">{table.grand.t}</span>{" "}
        (मुले {table.grand.m}, मुली {table.grand.f}).
      </p>

      {/* Wide by nature: it scrolls inside its own box, never the page. */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left dark:border-slate-800">
              <th className="sticky left-0 bg-white px-3 py-2 font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                {t("field.category")}
              </th>
              {table.classes.map((c) => (
                <th key={c} colSpan={3} className="px-2 py-2 text-center font-medium text-slate-500 dark:text-slate-400">
                  {t("students.class")} {toDevanagariDigits(c)}
                </th>
              ))}
              <th colSpan={3} className="px-2 py-2 text-center font-medium text-slate-900 dark:text-slate-50">
                एकूण
              </th>
            </tr>
            <tr className="border-b border-slate-200 text-xs dark:border-slate-800">
              <th className="sticky left-0 bg-white dark:bg-slate-900" />
              {[...table.classes, "total"].map((c) => (
                <>
                  <th key={`${c}m`} className="px-1 py-1 text-center font-normal text-slate-400">मु</th>
                  <th key={`${c}f`} className="px-1 py-1 text-center font-normal text-slate-400">मु.</th>
                  <th key={`${c}t`} className="px-1 py-1 text-center font-medium text-slate-500">एकूण</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                <td className="sticky left-0 bg-white px-3 py-2 dark:bg-slate-900">
                  <div className="font-medium text-slate-900 dark:text-slate-50">
                    {r.category === "—" ? "अनोंदित" : r.category}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {r.category === "—"
                      ? "not recorded"
                      : (CATEGORY_LABEL[r.category as keyof typeof CATEGORY_LABEL] ?? "").split(" — ")[1]}
                  </div>
                </td>
                {table.classes.map((c) => (
                  <>
                    <td key={`${r.category}${c}m`} className="px-1 py-2 text-center tabular-nums text-slate-600 dark:text-slate-400">{d(r.byClass[c].m)}</td>
                    <td key={`${r.category}${c}f`} className="px-1 py-2 text-center tabular-nums text-slate-600 dark:text-slate-400">{d(r.byClass[c].f)}</td>
                    <td key={`${r.category}${c}t`} className="px-1 py-2 text-center tabular-nums font-medium text-slate-900 dark:text-slate-50">{d(r.byClass[c].t)}</td>
                  </>
                ))}
                <td className="px-1 py-2 text-center tabular-nums text-slate-600 dark:text-slate-400">{d(r.total.m)}</td>
                <td className="px-1 py-2 text-center tabular-nums text-slate-600 dark:text-slate-400">{d(r.total.f)}</td>
                <td className="px-1 py-2 text-center tabular-nums font-semibold text-slate-900 dark:text-slate-50">{d(r.total.t)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold dark:bg-slate-800/40">
              <td className="sticky left-0 bg-slate-50 px-3 py-2 dark:bg-slate-800/40">एकूण</td>
              {table.classes.map((c) => {
                const col = rows.reduce(
                  (acc, r) => ({ m: acc.m + r.byClass[c].m, f: acc.f + r.byClass[c].f, t: acc.t + r.byClass[c].t }),
                  { m: 0, f: 0, t: 0 },
                );
                return (
                  <>
                    <td key={`t${c}m`} className="px-1 py-2 text-center tabular-nums">{d(col.m)}</td>
                    <td key={`t${c}f`} className="px-1 py-2 text-center tabular-nums">{d(col.f)}</td>
                    <td key={`t${c}t`} className="px-1 py-2 text-center tabular-nums">{d(col.t)}</td>
                  </>
                );
              })}
              <td className="px-1 py-2 text-center tabular-nums">{d(table.grand.m)}</td>
              <td className="px-1 py-2 text-center tabular-nums">{d(table.grand.f)}</td>
              <td className="px-1 py-2 text-center tabular-nums">{d(table.grand.t)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
