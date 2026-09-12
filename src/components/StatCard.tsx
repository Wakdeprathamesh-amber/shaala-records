import Link from "next/link";

const TONES = {
  neutral: "text-slate-900 dark:text-slate-50",
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
} as const;

export function StatCard({
  label,
  value,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | string;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const body = (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 transition
                 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900
                 dark:hover:border-slate-700"
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${TONES[tone]}`}>{value}</p>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
