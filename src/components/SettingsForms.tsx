"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Field } from "@/components/Field";
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
  const v = (k: string) => (school[k] as string | null) ?? "";
  const err = (k: string) => state.fieldErrors?.[k];

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <Banner state={state} />
      <Field name="sansthaNameMr" label={labels.sanstha} defaultValue={v("sansthaNameMr")} />
      <Field name="mottoMr" label={labels.motto} defaultValue={v("mottoMr")} placeholder="तमसो मा ज्योतिर्गमय" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="nameMr" label={`${labels.name} (मराठी)`} defaultValue={v("nameMr")} required error={err("nameMr")} />
        <Field name="nameEn" label={`${labels.name} (English)`} defaultValue={v("nameEn")} required error={err("nameEn")} />
        <Field name="udiseCode" label="UDISE" defaultValue={v("udiseCode")} required inputMode="numeric" error={err("udiseCode")} />
        <Field name="boardIndex" label="Board index" defaultValue={v("boardIndex")} error={err("boardIndex")} />
        <Field name="recognitionNo" label={labels.recognitionNo} defaultValue={v("recognitionNo")} />
        <Field name="managementType" label="Management" defaultValue={v("managementType")} />
        <Field name="medium" label="Medium" defaultValue={v("medium")} />
        <Field name="taluka" label={labels.taluka} defaultValue={v("taluka")} />
        <Field name="district" label={labels.district} defaultValue={v("district")} />
      </div>
      <Field name="address" label={labels.address} defaultValue={v("address")} />
      <Field name="recognitionDetailsMr" label={labels.recognitionDetails} defaultValue={v("recognitionDetailsMr")} />
      <Field name="principalNameMr" label={labels.principal} defaultValue={v("principalNameMr")} />
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
