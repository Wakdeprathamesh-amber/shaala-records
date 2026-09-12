const TONE = {
  studying: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  left: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  tc_issued: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
} as const;

export function StatusBadge({
  status,
  label,
}: {
  status: keyof typeof TONE;
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status]}`}
    >
      {label}
    </span>
  );
}
