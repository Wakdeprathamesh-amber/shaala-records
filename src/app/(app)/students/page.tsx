import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { list, type StudentListRow } from "@/domain/students/repo";
import { StudentFilterSchema } from "@/domain/students/schema";

export const metadata = { title: "विद्यार्थी — Students" };

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
    page: raw.page || 1,
  });

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
        subtitle={`${t("common.showing")} ${rows.length} ${t("common.of")} ${total}`}
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

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          name="search"
          defaultValue={raw.search ?? ""}
          placeholder={t("students.searchPlaceholder")}
          aria-label={t("action.search")}
          className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-base
                     dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        />
        <select
          name="class"
          defaultValue={raw.class ?? ""}
          aria-label={t("students.class")}
          className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-base
                     dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        >
          <option value="">{t("students.class")}</option>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={raw.status ?? ""}
          aria-label={t("students.status")}
          className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-base
                     dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        >
          <option value="">{t("students.status")}</option>
          <option value="studying">{t("status.studying")}</option>
          <option value="left">{t("status.left")}</option>
          <option value="tc_issued">{t("status.tc_issued")}</option>
        </select>
        <button
          type="submit"
          className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-sm font-medium
                     text-slate-700 hover:bg-slate-100 dark:border-slate-700
                     dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {t("action.search")}
        </button>
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
