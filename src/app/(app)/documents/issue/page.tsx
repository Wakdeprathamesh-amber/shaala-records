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
  searchParams: Promise<{ student?: string }>;
}) {
  const ctx = await requireCtx();
  const t = await getT();
  const { student: studentId } = await searchParams;

  // No student chosen yet: show a picker rather than an empty form.
  if (!studentId) {
    const { rows } = await list(ctx, { page: 1, status: "studying" } as never);
    return (
      <>
        <PageHeader title={t("action.issue")} subtitle={t("students.searchPlaceholder")} />
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/documents/issue?student=${r.id}`}
                className="flex min-h-[44px] items-center justify-between rounded-lg border
                           border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300
                           dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="text-slate-900 dark:text-slate-50">{r.nameMr}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("students.gr")} {r.grNumber}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm">
          <Link href="/students" className="underline">
            {t("students.title")} →
          </Link>
        </p>
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
