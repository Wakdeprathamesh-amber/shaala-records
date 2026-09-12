import Link from "next/link";

export type Column<T> = {
  key: string;
  header: string;
  /** Right-align and use tabular figures — for GR numbers, serials, counts. */
  numeric?: boolean;
  /** Hide on small screens when the card layout already shows it. */
  cell: (row: T) => React.ReactNode;
};

/**
 * A table on desktop, a stack of cards under 640px.
 *
 * Tables do not degrade gracefully on a phone: they either overflow the
 * viewport or squeeze columns until nothing is readable. Below 640px this
 * renders `mobileCard` instead, so the clerk's phone gets a layout designed
 * for it rather than a shrunken desktop one.
 */
export function DataTable<T>({
  rows,
  columns,
  keyOf,
  hrefOf,
  mobileCard,
  empty,
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  keyOf: (row: T) => string;
  hrefOf?: (row: T) => string;
  mobileCard: (row: T) => React.ReactNode;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center
                    text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {empty}
      </p>
    );
  }

  return (
    <>
      {/* Cards — under 640px */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {rows.map((row) => {
          const card = (
            <div
              className="rounded-xl border border-slate-200 bg-white p-3
                         dark:border-slate-800 dark:bg-slate-900"
            >
              {mobileCard(row)}
            </div>
          );
          const href = hrefOf?.(row);
          return (
            <li key={keyOf(row)}>
              {href ? (
                <Link href={href} className="block min-h-[44px]">
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>

      {/* Table — 640px and up */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200
                      bg-white sm:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-3 py-2.5 font-medium text-slate-500 dark:text-slate-400 ${
                    col.numeric ? "text-right" : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = hrefOf?.(row);
              return (
                <tr
                  key={keyOf(row)}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50
                             dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                >
                  {columns.map((col, i) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 align-middle ${
                        col.numeric ? "text-right tabular-nums" : "text-left"
                      }`}
                    >
                      {href && i === 0 ? (
                        <Link
                          href={href}
                          className="block underline-offset-2 hover:underline"
                        >
                          {col.cell(row)}
                        </Link>
                      ) : (
                        col.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
