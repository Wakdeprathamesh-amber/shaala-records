import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { requireCtx } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { byId, enrollmentHistory } from "@/domain/students/repo";
import { documentsForStudent } from "@/domain/documents/repo";
import { dateToMarathiWords, toDevanagariDigits } from "@/lib/marathi/numbers";
import { setStudentStatus } from "@/domain/students/actions";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-50">{value || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800/60">{children}</dl>
    </section>
  );
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCtx();
  const { id } = await params;
  const t = await getT();

  const s = await byId(ctx, id);
  if (!s) notFound();

  const [history, docs] = await Promise.all([
    enrollmentHistory(ctx, id),
    documentsForStudent(ctx, id),
  ]);
  const current = history.find((e) => e.academicYearId === ctx.academicYearId);

  const nameMr = [s.firstNameMr, s.middleNameMr, s.lastNameMr].filter(Boolean).join(" ");
  const nameEn = [s.firstNameEn, s.middleNameEn, s.lastNameEn].filter(Boolean).join(" ");
  const dobDate = new Date(`${s.dob}T00:00:00Z`);

  return (
    <>
      <PageHeader
        title={nameMr}
        subtitle={`${nameEn} · ${t("students.gr")} ${s.grNumber}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/documents/issue?student=${s.id}`}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300
                         px-4 text-sm font-medium text-slate-700 hover:bg-slate-100
                         dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("action.issue")}
            </Link>
            <Link
              href={`/students/${s.id}/edit`}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-4
                         text-sm font-medium text-white hover:bg-slate-800
                         dark:bg-slate-50 dark:text-slate-900"
            >
              {t("action.edit")}
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={s.status} label={t(`status.${s.status}` as "status.studying")} />
        <form action={setStudentStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={s.id} />
          <select
            name="status"
            defaultValue={s.status}
            aria-label={t("students.status")}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm
                       dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="studying">{t("status.studying")}</option>
            <option value="left">{t("status.left")}</option>
            <option value="tc_issued">{t("status.tc_issued")}</option>
          </select>
          <button
            type="submit"
            className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm
                       text-slate-700 hover:bg-slate-100 dark:border-slate-700
                       dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t("action.save")}
          </button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("section.identity")}>
          <Row label={t("students.gr")} value={toDevanagariDigits(s.grNumber)} />
          <Row label={t("field.apaarId")} value={s.apaarId} />
          <Row label={`${t("students.name")} (${t("field.marathi")})`} value={nameMr} />
          <Row label={`${t("students.name")} (${t("field.english")})`} value={nameEn} />
          <Row label={t("students.gender")} value={t(`gender.${s.gender}` as "gender.male")} />
          <Row label={t("field.bloodGroup")} value={s.bloodGroup} />
        </Section>

        <Section title={t("section.birth")}>
          <Row label={t("students.dob")} value={toDevanagariDigits(s.dob.split("-").reverse().join("/"))} />
          {/* The words are what the certificate prints; showing them here lets
              the clerk catch an error before it is on a legal document. */}
          <Row label="अक्षरी" value={<span className="text-xs">{dateToMarathiWords(dobDate)}</span>} />
          <Row label={t("field.birthVillage")} value={s.birthVillage} />
          <Row label={t("field.birthTaluka")} value={s.birthTaluka} />
          <Row label={t("field.birthDistrict")} value={s.birthDistrict} />
          <Row label={t("field.birthState")} value={s.birthState} />
        </Section>

        <Section title={t("section.family")}>
          <Row label={t("field.motherName")} value={s.motherNameMr} />
          <Row label={`${t("field.motherName")} (EN)`} value={s.motherNameEn} />
          <Row label={t("field.fatherName")} value={s.fatherNameMr} />
          <Row label={`${t("field.fatherName")} (EN)`} value={s.fatherNameEn} />
        </Section>

        <Section title={t("section.social")}>
          <Row label={t("field.category")} value={s.category} />
          <Row label={t("field.caste")} value={s.caste} />
          <Row label={t("field.subCaste")} value={s.subCaste} />
          <Row label={t("field.religion")} value={s.religion} />
          <Row label={t("field.motherTongue")} value={s.motherTongue} />
          <Row label={t("field.nationality")} value={s.nationality} />
        </Section>

        <Section title={t("section.admission")}>
          <Row label={t("field.admissionDate")} value={toDevanagariDigits(s.admissionDate.split("-").reverse().join("/"))} />
          <Row label={t("field.admissionClass")} value={s.admissionClass} />
          <Row label={t("field.previousSchool")} value={s.previousSchool} />
          <Row label={t("field.lastClassPassed")} value={s.lastClassPassed} />
        </Section>

        <Section title={t("section.enrollment")}>
          <Row
            label={t("students.class")}
            value={current ? `${current.class}${current.division ? ` ${current.division}` : ""}` : "—"}
          />
          <Row label={t("students.rollNo")} value={current?.rollNo} />
          {history.length > 1 ? (
            <Row
              label="इतिहास"
              value={
                <ul className="text-xs text-slate-500 dark:text-slate-400">
                  {history.map((h) => (
                    <li key={h.id}>
                      {h.class}
                      {h.division ? ` ${h.division}` : ""}
                    </li>
                  ))}
                </ul>
              }
            />
          ) : null}
        </Section>
      </div>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t("doc.register")}
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("doc.none")}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-900 dark:text-slate-50">
                  {t(`doc.${d.docType}` as "doc.lc")} · {t("doc.serialNo")} {d.serialNo}
                  {d.isDuplicate ? (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {t("doc.duplicate")}
                    </span>
                  ) : null}
                </span>
                <a
                  href={`/api/documents/${d.id}/pdf`}
                  className="min-h-[44px] py-3 text-slate-600 underline dark:text-slate-400"
                >
                  {t("action.download")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
