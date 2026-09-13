/**
 * Pivots raw (class, category, gender, count) cells into the table the
 * MSBSHSE inspection register wants: one row per category, a boys/girls/total
 * triple per class, and totals down and across.
 *
 * Pure so it is testable. Every category row is present even at zero — an
 * inspector reading a register with a category missing assumes the school
 * forgot to count it, not that the count was nil.
 */
import { CATEGORIES } from "@/domain/students/schema";

export type Cell = { class: string; category: string | null; gender: string; n: number };
export type Counts = { m: number; f: number; o: number; t: number };
export type DemographicRow = { category: string; byClass: Record<string, Counts>; total: Counts };
export type DemographicTable = {
  classes: string[];
  rows: DemographicRow[];
  /** Students whose category is blank or unrecognised — surfaced, not hidden. */
  unknown: DemographicRow | null;
  grand: Counts;
};

const zero = (): Counts => ({ m: 0, f: 0, o: 0, t: 0 });

function bump(c: Counts, gender: string, n: number) {
  if (gender === "male") c.m += n;
  else if (gender === "female") c.f += n;
  else c.o += n;
  c.t += n;
}

/** Classes in school order: numeric first, "10" after "9", anything else after. */
export function sortClasses(classes: string[]): string[] {
  return [...new Set(classes)].sort((a, b) => {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    const ka = Number.isFinite(na) ? na : 999;
    const kb = Number.isFinite(nb) ? nb : 999;
    return ka - kb || a.localeCompare(b);
  });
}

export function buildDemographicTable(cells: Cell[]): DemographicTable {
  const classes = sortClasses(cells.map((c) => c.class));
  const emptyRow = (category: string): DemographicRow => ({
    category,
    byClass: Object.fromEntries(classes.map((c) => [c, zero()])),
    total: zero(),
  });

  const rows = CATEGORIES.map((c) => emptyRow(c));
  const byCategory = new Map(rows.map((r) => [r.category, r]));
  let unknown: DemographicRow | null = null;
  const grand = zero();

  for (const cell of cells) {
    let row = cell.category ? byCategory.get(cell.category) : undefined;
    if (!row) {
      unknown ??= emptyRow("—");
      row = unknown;
    }
    bump(row.byClass[cell.class], cell.gender, cell.n);
    bump(row.total, cell.gender, cell.n);
    bump(grand, cell.gender, cell.n);
  }

  return { classes, rows, unknown, grand };
}
