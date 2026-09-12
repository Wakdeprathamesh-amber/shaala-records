import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { register, type DocumentRegisterRow } from "@/domain/documents/repo";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

export const metadata = { title: "दाखले — Documents" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCtx();
  const t = await getT();
  const raw = await searchParams;

  const docType =
    raw.type === "lc" || raw.type === "bonafide" || raw.type === "id_card"
      ? raw.type
      : undefined;

  const { rows, total, page, pageSize } = await register(ctx, {
    docType,
    from: raw.from || undefined,
    to: raw.to || undefined,
    page: Number(raw.page) || 1,
  });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const typeLabel = (d: DocumentRegisterRow["docType"]) => t(`doc.${d}` as "doc.lc");

  const columns: Column<DocumentRegisterRow>[] = [
    {
      key: "serial",
      header: t("doc.serialNo"),
      numeric: true,
      cell: (r) => (
        <span>
          {toDevanagariDigits(r.serialNo)}
          {r.isDuplicate ? (
            <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {t("doc.duplicate")}
            </span>
          ) : null}
        </span>
      ),
    },
    { key: "type", header: t("nav.documents"), cell: (r) => typeLabel(r.docType) },
    {
      key: "student",
      header: t("students.name"),
      cell: (r) => (
        <div>
          <div className="text-slate-900 dark:text-slate-50">{r.nameMr}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t("students.gr")} {r.grNumber}
          </div>
        </div>
      ),
    },
    {
      key: "issued",
      header: t("doc.issuedOn"),
      cell: (r) => toDevanagariDigits(r.issuedOn.split("-").reverse().join("/")),
    },
    { key: "by", header: "—", cell: (r) => <span className="text-xs">{r.issuedBy}</span> },
  ];

  const tab = (value: string | undefined, label: string) => {
    const active = docType === value || (!docType && !value);
    const href = value ? `/documents?type=${value}` : "/documents";
    return (
      <Link
        key={label}
        href={href}
        className={`inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm ${
          active
            ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
            : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <PageHeader
        title={t("doc.register")}
        subtitle={`${t("common.showing")} ${rows.length} ${t("common.of")} ${total}`}
        action={
          <Link
            href="/documents/issue"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-4
                       text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900"
          >
            + {t("action.issue")}
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tab(undefined, t("common.showing"))}
        {tab("lc", t("doc.lc"))}
        {tab("bonafide", t("doc.bonafide"))}
        {tab("id_card", t("doc.id_card"))}
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        keyOf={(r) => r.id}
        hrefOf={(r) => `/documents/${r.id}`}
        empty={t("doc.none")}
        mobileCard={(r) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900 dark:text-slate-50">
                {typeLabel(r.docType)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t("doc.serialNo")} {toDevanagariDigits(r.serialNo)}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-slate-700 dark:text-slate-300">{r.nameMr}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("students.gr")} {r.grNumber} ·{" "}
              {toDevanagariDigits(r.issuedOn.split("-").reverse().join("/"))}
              {r.isDuplicate ? ` · ${t("doc.duplicate")}` : ""}
            </p>
          </div>
        )}
      />

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/documents?${new URLSearchParams({ ...raw, page: String(page - 1) } as Record<string, string>)}`} className="py-3 underline">
              ← {t("action.previous")}
            </Link>
          ) : <span />}
          <span className="text-slate-500 dark:text-slate-400">{page} {t("common.of")} {pages}</span>
          {page < pages ? (
            <Link href={`/documents?${new URLSearchParams({ ...raw, page: String(page + 1) } as Record<string, string>)}`} className="py-3 underline">
              {t("action.next")} →
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </>
  );
}
