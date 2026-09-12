/**
 * Config-driven mapper for government upload files.
 *
 * The UDISE+ workbook changes by government resolution, usually with little
 * notice and often in September. If the column list lived in code, every
 * change would be a deploy at exactly the moment schools cannot afford one.
 * So the mapping is data: a JSON template naming each column, where its value
 * comes from, and how to transform it.
 *
 * Pure — no database, no server-only — so the same mapping runs in tests and
 * in the export pipeline.
 */
import udise202627 from "./templates/udise-2026-27.json";

export type ColumnSpec = {
  header: string;
  /** Dotted path into the row, e.g. "student.nameEn". */
  source: string;
  required?: boolean;
  transform?: string;
  rule?: string;
};

export type ExportTemplate = {
  id: string;
  label: string;
  sheet: string;
  headerRow: number;
  note?: string;
  maps?: Record<string, Record<string, string>>;
  columns: ColumnSpec[];
};

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

const TEMPLATES: Record<string, ExportTemplate> = {
  [udise202627.id]: udise202627 as ExportTemplate,
};

export function listTemplates(): ExportTemplate[] {
  return Object.values(TEMPLATES);
}

export function loadTemplate(id: string): ExportTemplate {
  const t = TEMPLATES[id];
  if (!t) {
    throw new TemplateError(
      `Unknown export template "${id}". Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }
  return t;
}

/**
 * Row shape the mapper reads from.
 *
 * Deliberately loose: sources are dotted paths resolved at runtime from the
 * template, so the mapper cannot know the shape statically. Constraining the
 * values to nested records would forbid the flat identifying fields the
 * validator needs alongside them on the same object.
 */
export type ExportRow = Record<string, unknown>;

function readPath(row: ExportRow, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
    row,
  );
}

const DATE_FORMATS: Record<string, (y: string, m: string, d: string) => string> = {
  "DD/MM/YYYY": (y, m, d) => `${d}/${m}/${y}`,
  "DD-MM-YYYY": (y, m, d) => `${d}-${m}-${y}`,
  "MM/DD/YYYY": (y, m, d) => `${m}/${d}/${y}`,
  "YYYY-MM-DD": (y, m, d) => `${y}-${m}-${d}`,
};

/**
 * Applies one declared transform.
 *
 * An empty value stays empty rather than becoming "null" or "NULL" — a
 * literal "null" in a government file is a rejected row, and the cause is
 * not obvious from the portal's error message.
 */
export function applyTransform(
  value: unknown,
  transform: string | undefined,
  maps: Record<string, Record<string, string>> = {},
): string {
  if (value === null || value === undefined || value === "") return "";
  if (!transform) return String(value);

  if (transform === "upper") return String(value).toUpperCase();
  if (transform === "lower") return String(value).toLowerCase();
  if (transform === "trim") return String(value).trim();

  if (transform.startsWith("date:")) {
    const fmt = transform.slice(5);
    const formatter = DATE_FORMATS[fmt];
    if (!formatter) {
      throw new TemplateError(
        `Unknown date format "${fmt}". Known: ${Object.keys(DATE_FORMATS).join(", ")}`,
      );
    }
    const iso = String(value).slice(0, 10);
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return String(value);
    return formatter(y, m, d);
  }

  if (transform.startsWith("map:")) {
    const name = transform.slice(4);
    const table = maps[name];
    if (!table) {
      throw new TemplateError(
        `Template references map table "${name}", which it does not define.`,
      );
    }
    const key = String(value);
    // An unmapped value passes through rather than blanking. Blanking would
    // silently drop data; passing it through makes the portal reject that one
    // row, which is visible and fixable.
    return table[key] ?? key;
  }

  if (transform.startsWith("maxlen:")) {
    const n = Number(transform.slice(7));
    return String(value).slice(0, n);
  }

  throw new TemplateError(
    `Unknown transform "${transform}". Known: upper, lower, trim, date:*, map:*, maxlen:*`,
  );
}

/** Applies a column's `rule` after transformation, where the rule also shapes
 *  output (maxlen). Validation rules are checked separately by validate.ts. */
function applyRule(value: string, rule: string | undefined): string {
  if (!rule) return value;
  for (const part of rule.split("|")) {
    if (part.startsWith("maxlen:")) value = value.slice(0, Number(part.slice(7)));
    if (part === "upper") value = value.toUpperCase();
  }
  return value;
}

/** Maps rows to a 2-D array in the template's column order. */
export function mapRows(rows: ExportRow[], template: ExportTemplate): string[][] {
  const maps = template.maps ?? {};
  return rows.map((row) =>
    template.columns.map((col) => {
      const raw = readPath(row, col.source);
      const transformed = applyTransform(raw, col.transform, maps);
      return applyRule(transformed, col.rule);
    }),
  );
}

export function headerRow(template: ExportTemplate): string[] {
  return template.columns.map((c) => c.header);
}
