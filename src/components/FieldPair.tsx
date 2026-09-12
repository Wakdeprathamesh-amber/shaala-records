import { Field } from "./Field";

/**
 * One logical name in both scripts.
 *
 * The Marathi field comes first because it is the statutory record — what the
 * register holds and what the certificate prints. English exists for the
 * government upload, which rejects Devanagari outright.
 *
 * Side by side on desktop, stacked on mobile, so the clerk copying from a
 * paper register sees the pair as one unit rather than hunting for the
 * matching field halfway down the form.
 */
export function FieldPair({
  nameMr,
  nameEn,
  label,
  mrLabel,
  enLabel,
  defaultMr,
  defaultEn,
  required,
  errorMr,
  errorEn,
}: {
  nameMr: string;
  nameEn: string;
  label: string;
  mrLabel: string;
  enLabel: string;
  defaultMr?: string | null;
  defaultEn?: string | null;
  required?: boolean;
  errorMr?: string;
  errorEn?: string;
}) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <legend className="px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name={nameMr}
          label={mrLabel}
          defaultValue={defaultMr}
          required={required}
          error={errorMr}
        />
        <Field
          name={nameEn}
          label={enLabel}
          defaultValue={defaultEn}
          required={required}
          error={errorEn}
        />
      </div>
    </fieldset>
  );
}
