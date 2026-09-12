import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { byId } from "@/domain/documents/repo";
import type { DocumentPayload } from "@/domain/documents/issue";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCtx();
  const { id } = await params;
  const t = await getT();

  const doc = await byId(ctx, id);
  if (!doc) notFound();

  const p = doc.payloadJson as DocumentPayload;

  return (
    <>
      <PageHeader
        title={t(`doc.${p.docType}` as "doc.lc")}
        subtitle={`${t("doc.serialNo")} ${toDevanagariDigits(p.serialNo)} · ${p.studentNameMr}`}
        action={
          <a
            href={`/api/documents/${doc.id}/pdf`}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-4
                       text-sm font-medium text-white dark:bg-slate-50 dark:text-slate-900"
          >
            {t("action.download")}
          </a>
        }
      />

      {p.isDuplicate ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm
                        text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t("doc.duplicate")} — this reprint carries the original serial.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <dl className="rounded-xl border border-slate-200 bg-white p-4 text-sm
                       dark:border-slate-800 dark:bg-slate-900">
          {[
            [t("doc.serialNo"), toDevanagariDigits(p.serialNo)],
            [t("doc.issuedOn"), toDevanagariDigits(p.issuedOn.split("-").reverse().join("/"))],
            [t("students.gr"), toDevanagariDigits(p.grNumber)],
            [t("students.name"), p.studentNameMr],
            [t("students.class"), `${p.currentClass ?? "—"}${p.currentDivision ?? ""}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800/60">
              <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
              <dd className="text-slate-900 dark:text-slate-50">{v}</dd>
            </div>
          ))}
          <div className="pt-3">
            <Link href={`/students/${doc.studentId}`} className="text-sm underline">
              {t("students.title")} →
            </Link>
          </div>
        </dl>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800">
          <iframe
            src={`/api/documents/${doc.id}/pdf`}
            title={t("action.preview")}
            className="h-[75vh] w-full"
          />
        </div>
      </div>
    </>
  );
}
