"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Field } from "@/components/Field";
import { LogoField } from "@/components/LogoField";
import type { SettingsState } from "@/domain/settings/actions";

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

function Banner({ state }: { state: SettingsState }) {
  if (state.ok) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm
                    text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        {state.ok}
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm
                    text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {state.error}
      </p>
    );
  }
  return null;
}

type Action = (prev: SettingsState, fd: FormData) => Promise<SettingsState>;

/**
 * The school's full profile, in both scripts.
 *
 * Grouped the way a principal reads their own letterhead, top to bottom:
 * who runs the school, what it is called, what recognises it, where it is,
 * how to reach it. A single flat list of twenty-five inputs is technically the
 * same form and nobody finishes it.
 *
 * Every Marathi field sits beside its English counterpart, because the pair
 * is one fact — and the English side is what the government upload uses, so
 * discovering it is blank in September is too late.
 */
export function SchoolForm({
  action,
  school,
  labels,
}: {
  action: Action;
  school: Record<string, unknown>;
  labels: Record<string, string>;
}) {
  const [state, formAction] = useActionState<SettingsState, FormData>(action, {});
  const v = (k: string) => (state.values?.[k] ?? (school[k] as string | null) ?? "") as string;
  const err = (k: string) => state.fieldErrors?.[k];

  const Group = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </legend>
      {hint ? <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      <div className="grid gap-3">{children}</div>
    </fieldset>
  );

  /** Marathi and English side by side — one fact, two scripts. */
  const Pair = ({ name, label, required }: { name: string; label: string; required?: boolean }) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field name={name} label={`${label} (मराठी)`} defaultValue={v(name)} required={required} error={err(name)} />
      <Field
        name={`${name.replace(/Mr$/, "")}En`}
        label={`${label} (English)`}
        defaultValue={v(`${name.replace(/Mr$/, "")}En`)}
        required={required}
        error={err(`${name.replace(/Mr$/, "")}En`)}
      />
    </div>
  );

  return (
    <form action={formAction} className="grid gap-4" noValidate encType="multipart/form-data">
      <Banner state={state} />

      <Group title={labels.gIdentity}>
        <LogoField
          label={labels.logo}
          hint={labels.logoHint}
          chooseLabel={labels.logoChoose}
          removeLabel={labels.logoRemove}
          currentSrc={school.logoPath ? `/api/images/${school.logoPath as string}` : null}
          error={err("logo")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="sansthaNameMr" label={`${labels.sanstha} (मराठी)`} defaultValue={v("sansthaNameMr")} />
          <Field name="sansthaNameEn" label={`${labels.sanstha} (English)`} defaultValue={v("sansthaNameEn")} />
        </div>
        <Field name="mottoMr" label={labels.motto} defaultValue={v("mottoMr")} placeholder="तमसो मा ज्योतिर्गमय" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="nameMr" label={`${labels.name} (मराठी)`} defaultValue={v("nameMr")} required error={err("nameMr")} />
          <Field name="nameEn" label={`${labels.name} (English)`} defaultValue={v("nameEn")} required error={err("nameEn")} />
        </div>
      </Group>

      <Group title={labels.gRecognition} hint={labels.gRecognitionHint}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="udiseCode" label="यू-डायस क्र. — UDISE" defaultValue={v("udiseCode")} required inputMode="numeric" error={err("udiseCode")} />
          <Field name="recognitionNo" label={labels.recognitionNo} defaultValue={v("recognitionNo")} error={err("recognitionNo")} />
          <Field name="jrCollegeIndexNo" label={labels.jrIndex} defaultValue={v("jrCollegeIndexNo")} />
          <Field name="boardIndex" label={labels.boardIndex} defaultValue={v("boardIndex")} />
        </div>
        <Field name="recognitionDetailsMr" label={labels.recognitionDetails} defaultValue={v("recognitionDetailsMr")} />
      </Group>

      <Group title={labels.gAddress}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="village" label={labels.village} defaultValue={v("village")} placeholder="रावडी" />
          <Field name="postOffice" label={labels.postOffice} defaultValue={v("postOffice")} placeholder="चिखलगाव" />
          <Field name="pincode" label={labels.pincode} defaultValue={v("pincode")} inputMode="numeric" placeholder="412206" error={err("pincode")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="taluka" label={`${labels.taluka} (मराठी)`} defaultValue={v("taluka")} required error={err("taluka")} />
          <Field name="talukaEn" label={`${labels.taluka} (English)`} defaultValue={v("talukaEn")} />
          <Field name="district" label={`${labels.district} (मराठी)`} defaultValue={v("district")} required error={err("district")} />
          <Field name="districtEn" label={`${labels.district} (English)`} defaultValue={v("districtEn")} />
        </div>
        <Field name="state" label={labels.state} defaultValue={v("state") || "महाराष्ट्र"} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="address" label={`${labels.address} (मराठी)`} defaultValue={v("address")} />
          <Field name="addressEn" label={`${labels.address} (English)`} defaultValue={v("addressEn")} />
        </div>
      </Group>

      <Group title={labels.gContact}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="phone" label={labels.phone} defaultValue={v("phone")} error={err("phone")} />
          <Field name="email" label={labels.email} type="email" defaultValue={v("email")} error={err("email")} />
          <Field name="medium" label={labels.medium} defaultValue={v("medium")} placeholder="मराठी" />
          <Field name="managementType" label={labels.management} defaultValue={v("managementType")} />
        </div>
        <Pair name="principalNameMr" label={labels.principal} />
        <p className="text-xs text-slate-500 dark:text-slate-400">{labels.principalNote}</p>
      </Group>

      <div><Submit label={labels.save} /></div>
    </form>
  );
}

export function UserForm({ action, labels }: { action: Action; labels: Record<string, string> }) {
  const [state, formAction] = useActionState<SettingsState, FormData>(action, {});
  const err = (k: string) => state.fieldErrors?.[k];

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <Banner state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="name" label={labels.name} required error={err("name")} />
        <Field
          name="role"
          label={labels.role}
          required
          defaultValue="clerk"
          options={[
            { value: "clerk", label: labels.clerk },
            { value: "principal", label: labels.principal },
          ]}
        />
        <Field name="phone" label={labels.phone} inputMode="numeric" error={err("phone")} />
        <Field name="email" label={labels.email} type="email" error={err("email")} />
      </div>
      <Field name="password" label={labels.password} type="password" required error={err("password")} />
      <p className="text-xs text-slate-500 dark:text-slate-400">{labels.passwordNote}</p>
      <div><Submit label={labels.add} /></div>
    </form>
  );
}

export function YearForm({ action, labels }: { action: Action; labels: Record<string, string> }) {
  const [state, formAction] = useActionState<SettingsState, FormData>(action, {});
  const err = (k: string) => state.fieldErrors?.[k];

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <Banner state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field name="label" label={labels.year} placeholder="2027-28" required error={err("label")} />
        <Field name="startDate" label={labels.from} type="date" required error={err("startDate")} />
        <Field name="endDate" label={labels.to} type="date" required error={err("endDate")} />
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" name="makeCurrent" />
        {labels.makeCurrent}
      </label>
      <div><Submit label={labels.add} /></div>
    </form>
  );
}
