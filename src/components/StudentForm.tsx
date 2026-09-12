"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Field } from "@/components/Field";
import { FieldPair } from "@/components/FieldPair";
import type { StudentFormState } from "@/domain/students/actions";
import { CATEGORIES } from "@/domain/students/schema";

type Labels = Record<string, string>;

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

export function StudentForm({
  action,
  labels,
  student,
  enrollment,
  cancelHref,
}: {
  action: (prev: StudentFormState, formData: FormData) => Promise<StudentFormState>;
  labels: Labels;
  student?: Record<string, unknown> | null;
  enrollment?: { class?: string | null; division?: string | null; rollNo?: number | null } | null;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<StudentFormState, FormData>(action, {});

  // On a failed submit, prefer what the user typed over what was loaded.
  // React 19 resets an uncontrolled form after its action runs, so these
  // defaults are the only thing standing between a typo and re-entering
  // the whole register page.
  const v = (k: string) =>
    state.values?.[k] ?? ((student?.[k] as string | null | undefined) ?? "");
  const err = (k: string) => state.fieldErrors?.[k];

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {student?.id ? <input type="hidden" name="id" value={String(student.id)} /> : null}

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800
                     dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {state.error}
        </div>
      ) : null}

      <Section title={labels.identity}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="grNumber"
            label={labels.gr}
            hint={student ? undefined : labels.autoAssigned}
            defaultValue={v("grNumber")}
            inputMode="numeric"
            error={err("grNumber")}
          />
          <Field
            name="apaarId"
            label={labels.apaar}
            hint="12 digits"
            defaultValue={v("apaarId")}
            inputMode="numeric"
            error={err("apaarId")}
          />
        </div>

        <FieldPair
          label={labels.studentName}
          mrLabel={labels.marathi}
          enLabel={labels.english}
          nameMr="firstNameMr"
          nameEn="firstNameEn"
          defaultMr={v("firstNameMr")}
          defaultEn={v("firstNameEn")}
          required
          errorMr={err("firstNameMr")}
          errorEn={err("firstNameEn")}
        />
        <FieldPair
          label={labels.middleName}
          mrLabel={labels.marathi}
          enLabel={labels.english}
          nameMr="middleNameMr"
          nameEn="middleNameEn"
          defaultMr={v("middleNameMr")}
          defaultEn={v("middleNameEn")}
          errorMr={err("middleNameMr")}
          errorEn={err("middleNameEn")}
        />
        <FieldPair
          label={labels.surname}
          mrLabel={labels.marathi}
          enLabel={labels.english}
          nameMr="lastNameMr"
          nameEn="lastNameEn"
          defaultMr={v("lastNameMr")}
          defaultEn={v("lastNameEn")}
          required
          errorMr={err("lastNameMr")}
          errorEn={err("lastNameEn")}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="gender"
            label={labels.gender}
            defaultValue={v("gender")}
            required
            error={err("gender")}
            options={[
              { value: "male", label: labels.male },
              { value: "female", label: labels.female },
              { value: "other", label: labels.other },
            ]}
          />
          <Field
            name="bloodGroup"
            label={labels.bloodGroup}
            defaultValue={v("bloodGroup")}
            error={err("bloodGroup")}
            options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => ({
              value: b,
              label: b,
            }))}
          />
        </div>
      </Section>

      <Section title={labels.birth}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="dob" label={labels.dob} type="date" defaultValue={v("dob")} required error={err("dob")} />
          <Field name="birthVillage" label={labels.birthVillage} defaultValue={v("birthVillage")} error={err("birthVillage")} />
          <Field name="birthTaluka" label={labels.taluka} defaultValue={v("birthTaluka")} error={err("birthTaluka")} />
          <Field name="birthDistrict" label={labels.district} defaultValue={v("birthDistrict")} error={err("birthDistrict")} />
          <Field name="birthState" label={labels.state} defaultValue={v("birthState")} error={err("birthState")} />
        </div>
      </Section>

      <Section title={labels.family}>
        <FieldPair
          label={labels.motherName}
          mrLabel={labels.marathi}
          enLabel={labels.english}
          nameMr="motherNameMr"
          nameEn="motherNameEn"
          defaultMr={v("motherNameMr")}
          defaultEn={v("motherNameEn")}
          errorMr={err("motherNameMr")}
          errorEn={err("motherNameEn")}
        />
        <FieldPair
          label={labels.fatherName}
          mrLabel={labels.marathi}
          enLabel={labels.english}
          nameMr="fatherNameMr"
          nameEn="fatherNameEn"
          defaultMr={v("fatherNameMr")}
          defaultEn={v("fatherNameEn")}
          errorMr={err("fatherNameMr")}
          errorEn={err("fatherNameEn")}
        />
      </Section>

      <Section title={labels.social}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="category"
            label={labels.category}
            defaultValue={v("category")}
            required
            error={err("category")}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <Field name="caste" label={labels.caste} defaultValue={v("caste")} error={err("caste")} />
          <Field name="subCaste" label={labels.subCaste} defaultValue={v("subCaste")} error={err("subCaste")} />
          <Field name="religion" label={labels.religion} defaultValue={v("religion")} error={err("religion")} />
          <Field name="motherTongue" label={labels.motherTongue} defaultValue={v("motherTongue")} error={err("motherTongue")} />
          <Field name="nationality" label={labels.nationality} defaultValue={v("nationality") || "Indian"} error={err("nationality")} />
        </div>
      </Section>

      <Section title={labels.admission}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="admissionDate" label={labels.admissionDate} type="date" defaultValue={v("admissionDate")} required error={err("admissionDate")} />
          <Field name="admissionClass" label={labels.admissionClass} defaultValue={v("admissionClass")} error={err("admissionClass")} />
          <Field name="previousSchool" label={labels.previousSchool} defaultValue={v("previousSchool")} error={err("previousSchool")} />
          <Field name="lastClassPassed" label={labels.lastClassPassed} defaultValue={v("lastClassPassed")} error={err("lastClassPassed")} />
        </div>
      </Section>

      <Section title={labels.enrollment}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="class" label={labels.class} defaultValue={state.values?.class ?? enrollment?.class ?? ""} />
          <Field name="division" label={labels.division} defaultValue={state.values?.division ?? enrollment?.division ?? ""} />
          <Field name="rollNo" label={labels.rollNo} inputMode="numeric" defaultValue={state.values?.rollNo ?? enrollment?.rollNo ?? ""} />
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <Submit label={labels.save} />
        <Link
          href={cancelHref}
          className="min-h-[44px] px-3 py-3 text-sm text-slate-600 hover:underline dark:text-slate-400"
        >
          {labels.cancel}
        </Link>
      </div>
    </form>
  );
}
