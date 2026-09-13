"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Field } from "@/components/Field";
import type { IssueFormState } from "@/domain/documents/actions";
import type { DocType } from "@/domain/documents/repo";

const DOC_TYPES: DocType[] = ["lc", "bonafide", "id_card", "character", "noc"];

const PURPOSES: Array<{ value: string; label: string }> = [
  { value: "scholarship", label: "शिष्यवृत्ती — Scholarship" },
  { value: "bank", label: "बँक खाते — Bank account" },
  { value: "passport", label: "पासपोर्ट — Passport" },
  { value: "caste", label: "जातीचा दाखला — Caste certificate" },
  { value: "domicile", label: "अधिवास — Domicile" },
  { value: "other", label: "इतर — Other" },
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-medium text-white
                 hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
    >
      {pending ? "…" : label}
    </button>
  );
}

export function IssueForm({
  action,
  studentId,
  studentName,
  grNumber,
  labels,
  hasOriginal,
}: {
  action: (prev: IssueFormState, fd: FormData) => Promise<IssueFormState>;
  studentId: string;
  studentName: string;
  grNumber: string;
  labels: Record<string, string>;
  hasOriginal: Record<DocType, boolean>;
}) {
  const [state, formAction] = useActionState<IssueFormState, FormData>(action, {});
  const [docType, setDocType] = useState<DocType>("bonafide");
  const [purpose, setPurpose] = useState("scholarship");
  const [dateOfLeaving, setDateOfLeaving] = useState("");
  const [reasonMr, setReasonMr] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [nocPurpose, setNocPurpose] = useState("");
  // A rendering choice, not part of the issued record — the download page
  // offers both variants of any LC regardless of what was previewed.
  const [bilingual, setBilingual] = useState(false);

  const previewUrl = useMemo(() => {
    const p = new URLSearchParams({ student: studentId, type: docType });
    if (docType === "bonafide") p.set("purpose", purpose);
    if (docType === "lc") {
      if (dateOfLeaving) p.set("dateOfLeaving", dateOfLeaving);
      if (reasonMr) p.set("reasonMr", reasonMr);
      if (bilingual) p.set("lang", "bi");
    }
    if (docType === "noc" && nocPurpose) p.set("nocPurposeMr", nocPurpose);
    return `/api/documents/preview?${p.toString()}`;
  }, [studentId, docType, purpose, dateOfLeaving, reasonMr, nocPurpose, bilingual]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <form action={formAction} className="grid gap-4" noValidate>
        <input type="hidden" name="studentId" value={studentId} />

        {state.error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800
                       dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {state.error}
          </div>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{studentName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {labels.gr} {grNumber}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
              {labels.docType}
            </legend>
            <div className="grid gap-2">
              {DOC_TYPES.map((t) => (
                <label
                  key={t}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border
                             border-slate-200 px-3 text-sm dark:border-slate-800"
                >
                  <input
                    type="radio"
                    name="docType"
                    value={t}
                    checked={docType === t}
                    onChange={() => setDocType(t)}
                  />
                  <span className="text-slate-900 dark:text-slate-50">{labels[t]}</span>
                  {hasOriginal[t] ? (
                    <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {labels.alreadyIssued}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </fieldset>

          {hasOriginal[docType] ? (
            <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                name="duplicate"
                checked={duplicate}
                onChange={(e) => setDuplicate(e.target.checked)}
              />
              {labels.reprint}
            </label>
          ) : null}
        </section>

        {docType === "lc" ? (
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <Field
              name="dateOfLeaving"
              label={labels.dateOfLeaving}
              type="date"
              required
              defaultValue={dateOfLeaving}
              onValueChange={setDateOfLeaving}
              error={state.fieldErrors?.dateOfLeaving}
            />
            <Field name="lastAttended" label={labels.lastAttended} type="date" />
            <Field
              name="reasonMr"
              label={labels.reason}
              defaultValue={reasonMr}
              onValueChange={setReasonMr}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="progress" label={labels.progress} defaultValue="समाधानकारक" />
              <Field name="conduct" label={labels.conduct} defaultValue="चांगले" />
            </div>
            <Field name="remarksMr" label={labels.remarks} />
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" name="duesCleared" value="1" defaultChecked />
              {labels.duesCleared}
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={bilingual}
                onChange={(e) => setBilingual(e.target.checked)}
              />
              {labels.bilingual}
            </label>
          </section>
        ) : null}

        {docType === "noc" ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <Field
              name="nocPurposeMr"
              label={labels.nocPurpose}
              defaultValue={nocPurpose}
              onValueChange={setNocPurpose}
              placeholder="इतर शाळेत प्रवेश घेण्यास"
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{labels.nocHint}</p>
          </section>
        ) : null}

        {docType === "bonafide" ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <Field
              name="purpose"
              label={labels.purpose}
              required
              defaultValue={purpose}
              onValueChange={setPurpose}
              options={PURPOSES}
            />
          </section>
        ) : null}

        <div className="flex items-center gap-3">
          <Submit label={labels.confirm} />
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-3 text-sm
                       text-slate-700 hover:bg-slate-100 dark:border-slate-700
                       dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {labels.openPreview}
          </a>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">{labels.serialNote}</p>
      </form>

      <div className="hidden lg:block">
        <div className="sticky top-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {labels.preview}
          </div>
          <iframe
            key={previewUrl}
            src={previewUrl}
            title={labels.preview}
            className="h-[70vh] w-full bg-white"
          />
        </div>
      </div>
    </div>
  );
}
