import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { list, type StudentListRow } from "@/domain/students/repo";
import {
  CATEGORIES,
  DIVISIONS,
  GENDERS,
  SORTS,
  StudentFilterSchema,
  activeFilters,
} from "@/domain/students/schema";

export const metadata = { title: "विद्यार्थी — Students" };

const SELECT =
  "min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 " +
  "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";

const SORT_LABEL: Record<string, string> = {
  gr: "जीआर क्र. — GR No.",
  name: "नाव — Name",
  class: "इयत्ता — Class",
  dob: "जन्मतारीख — DOB",
  recent: "नवीन नोंद — Recently added",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCtx();
  const t = await getT();
  const raw = await searchParams;

  const filter = StudentFilterSchema.parse({
    search: raw.search || undefined,
    class: raw.class || undefined,
    division: raw.division || undefined,
    status: raw.status || undefined,
    gender: raw.gender || undefined,
    category: raw.category || undefined,
    sort: raw.sort || undefined,
    dir: raw.dir || undefined,
    page: raw.page || 1,
  });
  const active = activeFilters(filter);

  const { rows, total, page, pageSize } = await list(ctx, filter);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const statusLabel = (s: StudentListRow["status"]) =>
    t(`status.${s}` as "status.studying");

  const columns: Column<StudentListRow>[] = [
    { key: "gr", header: t("students.gr"), numeric: true, cell: (r) => r.grNumber },
    {
      key: "name",
      header: t("students.name"),
      cell: (r) => (
        <div>
          <div className="text-slate-900 dark:text-slate-50">{r.nameMr}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{r.nameEn}</div>
        </div>
      ),
    },
    { key: "class", header: t("students.class"), cell: (r) => r.class ?? "—" },
    { key: "div", header: t("students.division"), cell: (r) => r.division ?? "—" },
    { key: "roll", header: t("students.rollNo"), numeric: true, cell: (r) => r.rollNo ?? "—" },
    {
      key: "status",
      header: t("students.status"),
      cell: (r) => <StatusBadge status={r.status} label={statusLabel(r.status)} />,
    },
  ];

  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...raw, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "") p.set(k, String(v));
    }
    return `?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title={t("students.title")}
        subtitle={`${t("common.showing")} ${rows.length} ${t("common.of")} ${total}${
          active.length ? ` · ${active.length} filter${active.length > 1 ? "s" : ""}` : ""
        }`}
        action={
          <Link
            href="/students/new"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-4
                       text-sm font-medium text-white hover:bg-slate-800
                       dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            + {t("students.new")}
          </Link>
        }
      />

      <form className="mb-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <input
            name="search"
            defaultValue={raw.search ?? ""}
            placeholder={t("students.searchPlaceholder")}
            aria-label={t("action.search")}
            className={SELECT}
          />
          <select name="class" defaultValue={raw.class ?? ""} aria-label={t("students.class")} className={SELECT}>
            <option value="">{t("students.class")} — सर्व</option>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="division" defaultValue={raw.division ?? ""} aria-label={t("students.division")} className={SELECT}>
            <option value="">{t("students.division")} — सर्व</option>
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select name="status" defaultValue={raw.status ?? ""} aria-label={t("students.status")} className={SELECT}>
            <option value="">{t("students.status")} — सर्व</option>
            <option value="studying">{t("status.studying")}</option>
            <option value="left">{t("status.left")}</option>
            <option value="tc_issued">{t("status.tc_issued")}</option>
          </select>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <select name="gender" defaultValue={raw.gender ?? ""} aria-label={t("students.gender")} className={SELECT}>
            <option value="">{t("students.gender")} — सर्व</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{t(`gender.${g}` as "gender.male")}</option>
            ))}
          </select>
          <select name="category" defaultValue={raw.category ?? ""} aria-label={t("field.category")} className={SELECT}>
            <option value="">{t("field.category")} — सर्व</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="sort" defaultValue={raw.sort ?? "gr"} aria-label="Sort" className={SELECT}>
            {SORTS.map((k) => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
          <select name="dir" defaultValue={raw.dir ?? "asc"} aria-label="Direction" className={SELECT}>
            <option value="asc">↑ चढता</option>
            <option value="desc">↓ उतरता</option>
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              className="min-h-[44px] flex-1 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white
                         hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {t("action.search")}
            </button>
            {active.length > 0 ? (
              <Link
                href="/students"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-3
                           text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700
                           dark:text-slate-200 dark:hover:bg-slate-800"
                title="Clear filters"
              >
                ✕ {active.length}
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      <DataTable
        rows={rows}
        columns={columns}
        keyOf={(r) => r.id}
        hrefOf={(r) => `/students/${r.id}`}
        empty={t("students.none")}
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-slate-50">
                {r.nameMr}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{r.nameEn}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("students.gr")} {r.grNumber}
                {r.class ? ` · ${t("students.class")} ${r.class}${r.division ?? ""}` : ""}
              </p>
            </div>
            <StatusBadge status={r.status} label={statusLabel(r.status)} />
          </div>
        )}
      />

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={qs({ page: page - 1 })} className="min-h-[44px] py-3 underline">
              ← {t("action.previous")}
            </Link>
          ) : <span />}
          <span className="text-slate-500 dark:text-slate-400">
            {page} {t("common.of")} {pages}
          </span>
          {page < pages ? (
            <Link href={qs({ page: page + 1 })} className="min-h-[44px] py-3 underline">
              {t("action.next")} →
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </>
  );
}
