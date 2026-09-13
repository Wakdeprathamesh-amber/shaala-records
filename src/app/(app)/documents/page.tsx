import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { DOC_TYPES, register, type DocType, type DocumentRegisterRow } from "@/domain/documents/repo";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

export const metadata = { title: "दाखले — Documents" };

const FIELD =
  "min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 " +
  "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCtx();
  const t = await getT();
  const raw = await searchParams;

  const docType = (DOC_TYPES as readonly string[]).includes(raw.type ?? "")
    ? (raw.type as DocType)
    : undefined;

  const duplicates =
    raw.dup === "only" || raw.dup === "hide" ? raw.dup : undefined;

  const { rows, total, page, pageSize } = await register(ctx, {
    docType,
    from: raw.from || undefined,
    to: raw.to || undefined,
    search: raw.search || undefined,
    duplicates,
    page: Number(raw.page) || 1,
  });
  const activeCount = [raw.search, raw.from, raw.to, raw.dup, docType].filter(Boolean).length;
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

      <div className="mb-3 flex flex-wrap gap-2">
        {tab(undefined, "सर्व — All")}
        {tab("lc", t("doc.lc"))}
        {tab("bonafide", t("doc.bonafide"))}
        {tab("id_card", t("doc.id_card"))}
        {tab("character", t("doc.character"))}
        {tab("noc", t("doc.noc"))}
      </div>

      <form className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] dark:border-slate-800 dark:bg-slate-900">
        {docType ? <input type="hidden" name="type" value={docType} /> : null}
        <input
          name="search"
          defaultValue={raw.search ?? ""}
          placeholder={t("students.searchPlaceholder")}
          aria-label={t("action.search")}
          className={FIELD}
        />
        <input name="from" type="date" defaultValue={raw.from ?? ""} aria-label="From" className={FIELD} />
        <input name="to" type="date" defaultValue={raw.to ?? ""} aria-label="To" className={FIELD} />
        <select name="dup" defaultValue={raw.dup ?? ""} aria-label={t("doc.duplicate")} className={FIELD}>
          <option value="">मूळ + प्रत — All copies</option>
          <option value="hide">फक्त मूळ — Originals only</option>
          <option value="only">फक्त प्रत — Duplicates only</option>
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="min-h-[44px] flex-1 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white
                       hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900"
          >
            {t("action.search")}
          </button>
          {activeCount > 0 ? (
            <Link
              href="/documents"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-3
                         text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700
                         dark:text-slate-200 dark:hover:bg-slate-800"
              title="Clear filters"
            >
              ✕ {activeCount}
            </Link>
          ) : null}
        </div>
      </form>

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
