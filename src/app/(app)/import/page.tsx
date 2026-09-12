import Link from "next/link";


import { PageHeader } from "@/components/PageHeader";
import { UploadForm } from "@/components/UploadForm";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { uploadRoll } from "@/domain/import/actions";
import { recentBatches } from "@/domain/import/repo";

export const metadata = { title: "आयात — Import" };

export default async function ImportPage() {
  const ctx = await requireCtx();
  const t = await getT();
  const batches = await recentBatches(ctx);

  return (
    <>
      <PageHeader title={t("import.title")} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("import.upload")}
          </h2>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            .xlsx, .xls किंवा .csv — कॉलम आपोआप ओळखले जातील, नंतर तुम्ही तपासू शकता.
          </p>
          <UploadForm action={uploadRoll} label={t("import.upload")} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
            मागील आयात — Previous imports
          </h2>
          {batches.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">—</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {batches.map((b) => (
                <li key={b.id} className="py-2">
                  <Link href={`/import/${b.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-900 dark:text-slate-50">{b.filename}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        b.status === "committed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : b.status === "failed"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {b.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
