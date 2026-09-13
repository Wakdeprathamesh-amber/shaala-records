import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { IssueForm } from "@/components/IssueForm";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { byId as studentById, list } from "@/domain/students/repo";
import { originalFor } from "@/domain/documents/repo";
import { issue } from "@/domain/documents/actions";

export const metadata = { title: "दाखला द्या — Issue document" };

export default async function IssuePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; q?: string }>;
}) {
  const ctx = await requireCtx();
  const t = await getT();
  const raw = await searchParams;
  const studentId = raw.student;

  // No student chosen yet.
  //
  // GR number first: that is how a clerk identifies a child at the counter —
  // the parent hands over an old certificate or says the number. Typing it is
  // one action; scrolling a list of eight hundred is not. Name search stays,
  // because the number is exactly what a parent sometimes cannot find.
  if (!studentId) {
    const query = (raw.q ?? "").trim();
    const { rows } = query
      ? await list(ctx, { search: query, page: 1 } as never)
      : await list(ctx, { page: 1, status: "studying" } as never);

    // An exact GR match is unambiguous — go straight to the form.
    const exact = query ? rows.find((r) => r.grNumber === query) : undefined;
    if (exact) redirect(`/documents/issue?student=${exact.id}`);

    return (
      <>
        <PageHeader title={t("action.issue")} />

        <form className="mb-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <label htmlFor="q" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            जनरल रजिस्टर क्रमांक
            <span className="ml-1 font-normal text-slate-400">किंवा नाव — or name</span>
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="q"
              name="q"
              defaultValue={query}
              autoFocus
              inputMode="numeric"
              placeholder="3862"
              className="min-h-[44px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base
                         text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-medium text-white
                         hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900"
            >
              {t("action.search")}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            क्रमांक बरोबर जुळल्यास थेट दाखल्याच्या फॉर्मवर जाल.
            {" "}An exact GR number opens the form directly.
          </p>
        </form>

        {query && rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm
                        text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t("students.none")}
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {query ? `${rows.length} जुळले — matches` : "सध्या शिकत असलेले — currently studying"}
            </p>
            <ul className="grid gap-2">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/documents/issue?student=${r.id}`}
                    className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg border
                               border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300
                               dark:border-slate-800 dark:bg-slate-900"
                  >
                    <span>
                      <span className="text-slate-900 dark:text-slate-50">{r.nameMr}</span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{r.nameEn}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {t("students.gr")} {r.grNumber}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  }

  const s = await studentById(ctx, studentId);
  if (!s) notFound();

  const [lc, bonafide, idCard, character, noc] = await Promise.all([
    originalFor(ctx, s.id, "lc"),
    originalFor(ctx, s.id, "bonafide"),
    originalFor(ctx, s.id, "id_card"),
    originalFor(ctx, s.id, "character"),
    originalFor(ctx, s.id, "noc"),
  ]);

  const nameMr = [s.firstNameMr, s.middleNameMr, s.lastNameMr].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader title={t("action.issue")} subtitle={nameMr} />
      <IssueForm
        action={issue}
        studentId={s.id}
        studentName={nameMr}
        grNumber={s.grNumber}
        hasOriginal={{
          lc: Boolean(lc),
          bonafide: Boolean(bonafide),
          id_card: Boolean(idCard),
          character: Boolean(character),
          noc: Boolean(noc),
        }}
        labels={{
          gr: t("students.gr"),
          docType: t("nav.documents"),
          lc: t("doc.lc"),
          bonafide: t("doc.bonafide"),
          id_card: t("doc.id_card"),
          character: t("doc.character"),
          noc: t("doc.noc"),
          nocPurpose: "कशासाठी — Purpose",
          nocHint: "उदा. इतर शाळेत प्रवेश घेण्यास, क्रीडा स्पर्धेत भाग घेण्यास, वसतिगृहात प्रवेशासाठी",
          bilingual: t("doc.bilingual"),
          alreadyIssued: t("doc.serialNo"),
          reprint: `${t("doc.duplicate")} — reprint`,
          dateOfLeaving: "शाळा सोडल्याचा दिनांक — Date of leaving",
          lastAttended: "शेवटची उपस्थिती — Last attended",
          reason: "कारण — Reason",
          progress: "प्रगती — Progress",
          conduct: "वर्तणूक — Conduct",
          remarks: "शेरा — Remarks",
          duesCleared: "सर्व देणी दिली — Dues cleared",
          purpose: "प्रयोजन — Purpose",
          purposeOther: "प्रयोजन लिहा — Write the purpose",
          confirm: t("action.confirm"),
          preview: t("action.preview"),
          openPreview: `${t("action.preview")} ↗`,
          serialNote:
            "पूर्वावलोकनाला अनुक्रमांक दिला जात नाही. निश्चित केल्यावरच क्रमांक मिळेल. — A preview is not numbered; the serial is allocated only on confirm.",
        }}
      />
    </>
  );
}
