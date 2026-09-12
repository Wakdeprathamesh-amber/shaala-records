const INPUT =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base " +
  "text-slate-900 outline-none min-h-[44px] placeholder:text-slate-400 " +
  "focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 " +
  "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-slate-400";

const LABEL = "block text-sm font-medium text-slate-700 dark:text-slate-300";
const ERR = "mt-1 text-sm text-red-600 dark:text-red-400";

export function Field({
  name,
  label,
  hint,
  type = "text",
  defaultValue,
  required,
  error,
  options,
  placeholder,
  inputMode,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  error?: string;
  options?: readonly { value: string; label: string }[];
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        {hint ? (
          <span className="ml-1 font-normal text-slate-400">{hint}</span>
        ) : null}
      </label>

      {options ? (
        <select
          // Remount when the default changes.
          //
          // React 19 resets a form after its action runs. For <input> it syncs
          // defaultValue to the value *attribute*, which a reset restores — so
          // echoed-back values reappear on their own. A <select> is driven by
          // option state instead, so a reset drops it back to the first option
          // and re-rendering alone will not restore it. Keying on the value
          // forces a fresh mount, which re-applies the selection.
          key={`${id}-${defaultValue ?? ""}`}
          id={id}
          name={name}
          defaultValue={defaultValue ?? ""}
          required={required}
          aria-invalid={Boolean(error)}
          className={INPUT}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          defaultValue={defaultValue ?? ""}
          required={required}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={INPUT}
        />
      )}

      {error ? (
        <p id={`${id}-error`} className={ERR}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
