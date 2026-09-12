/**
 * Parses an uploaded roll into staged rows.
 *
 * Schools arrive with a spreadsheet somebody made years ago: columns in any
 * order, headers in Marathi or English or both, a title row above the real
 * headers, blank separator rows. The importer guesses the mapping and then
 * shows it for confirmation, because guessing silently is how 800 children
 * get their mother's name in the caste column.
 *
 * Pure — the matching logic is testable without a database or a file.
 */
import { CATEGORIES } from "@/domain/students/schema";

export type ColumnGuess = {
  /** Index in the uploaded sheet. */
  index: number;
  header: string;
  /** Student field this column maps to, or null for "ignore". */
  field: string | null;
  confidence: number;
};

/**
 * Known headers per field, in both scripts.
 *
 * Deliberately generous: a false guess is cheap because the clerk confirms
 * the mapping, whereas a missed column means retyping it by hand.
 */
export const FIELD_ALIASES: Record<string, string[]> = {
  grNumber: ["gr no", "gr number", "gr", "general register", "जनरल रजिस्टर", "जि आर", "जीआर", "रजिस्टर क्र", "admission no", "adm no"],
  firstNameMr: ["नाव", "पहिले नाव", "विद्यार्थ्याचे नाव", "name marathi", "name mr"],
  middleNameMr: ["वडिलांचे नाव", "मधले नाव", "middle name mr"],
  lastNameMr: ["आडनाव", "surname mr", "last name mr"],
  firstNameEn: ["first name", "name english", "name en", "student name", "name"],
  middleNameEn: ["father name en", "middle name", "middle name en"],
  lastNameEn: ["surname", "last name", "surname en"],
  dob: ["dob", "date of birth", "birth date", "जन्मतारीख", "जन्म दिनांक"],
  gender: ["gender", "sex", "लिंग"],
  motherNameMr: ["आईचे नाव", "mother name mr", "आई"],
  motherNameEn: ["mother name", "mother name en", "mothers name"],
  fatherNameMr: ["वडील", "वडिलांचे संपूर्ण नाव", "father name mr"],
  fatherNameEn: ["father name", "fathers name", "father name en"],
  caste: ["caste", "जात"],
  subCaste: ["sub caste", "subcaste", "पोटजात"],
  category: ["category", "social category", "प्रवर्ग", "संवर्ग"],
  religion: ["religion", "धर्म"],
  motherTongue: ["mother tongue", "मातृभाषा"],
  birthVillage: ["birth place", "birth village", "जन्म गाव", "जन्मस्थळ"],
  birthTaluka: ["taluka", "तालुका"],
  birthDistrict: ["district", "जिल्हा"],
  birthState: ["state", "राज्य"],
  bloodGroup: ["blood group", "रक्तगट"],
  admissionDate: ["admission date", "date of admission", "प्रवेश दिनांक"],
  admissionClass: ["admission class", "प्रवेश इयत्ता"],
  apaarId: ["apaar", "apaar id", "pen", "अपार"],
  class: ["class", "standard", "std", "इयत्ता"],
  division: ["division", "section", "तुकडी"],
  rollNo: ["roll no", "roll number", "हजेरी क्र", "हजेरी क्रमांक"],
};

function normalise(s: string): string {
  return s.toLowerCase().replace(/[\s._/\\()-]/g, "").trim();
}

/** Scores 0..1 how well a header matches a known alias. */
function score(header: string, alias: string): number {
  const h = normalise(header);
  const a = normalise(alias);
  if (!h || !a) return 0;
  if (h === a) return 1;
  if (h.startsWith(a) || a.startsWith(h)) return 0.85;
  if (h.includes(a) || a.includes(h)) return 0.7;
  return 0;
}

/**
 * Guesses which uploaded column feeds which field.
 *
 * Each field is claimed at most once, strongest match first, so a sheet with
 * both "Name" and "Student Name" does not map both to firstNameEn and leave
 * the other unmapped.
 */
export function guessMapping(headers: string[]): ColumnGuess[] {
  const candidates: Array<{ index: number; field: string; confidence: number }> = [];

  headers.forEach((header, index) => {
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      const best = Math.max(...aliases.map((a) => score(header, a)));
      if (best > 0.6) candidates.push({ index, field, confidence: best });
    }
  });

  candidates.sort((a, b) => b.confidence - a.confidence);

  const takenField = new Set<string>();
  const takenIndex = new Set<number>();
  const assigned = new Map<number, { field: string; confidence: number }>();

  for (const c of candidates) {
    if (takenField.has(c.field) || takenIndex.has(c.index)) continue;
    takenField.add(c.field);
    takenIndex.add(c.index);
    assigned.set(c.index, { field: c.field, confidence: c.confidence });
  }

  return headers.map((header, index) => ({
    index,
    header,
    field: assigned.get(index)?.field ?? null,
    confidence: assigned.get(index)?.confidence ?? 0,
  }));
}

/**
 * Finds the header row.
 *
 * Sheets routinely open with a school name banner and a blank line. The
 * header row is the first one where several cells match known field names.
 */
export function findHeaderRow(rows: string[][], maxScan = 10): number {
  let bestRow = 0;
  let bestHits = 0;

  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const hits = guessMapping(rows[i]).filter((g) => g.field).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestRow = i;
    }
  }
  return bestHits >= 2 ? bestRow : 0;
}

export type StagedRow = {
  rowNumber: number;
  values: Record<string, string>;
};

/** Applies a confirmed mapping to the data rows. */
export function applyMapping(
  rows: string[][],
  mapping: ColumnGuess[],
  headerRowIndex: number,
): StagedRow[] {
  const fields = mapping.filter((m) => m.field);

  return rows
    .slice(headerRowIndex + 1)
    .map((row, i) => ({
      rowNumber: headerRowIndex + 2 + i,
      values: Object.fromEntries(
        fields.map((m) => [m.field!, (row[m.index] ?? "").toString().trim()]),
      ),
    }))
    // A wholly blank line is a separator, not a student.
    .filter((r) => Object.values(r.values).some((v) => v !== ""));
}

/** Coerces the loose values a spreadsheet holds into the shapes the schema wants. */
export function normaliseValues(values: Record<string, string>): Record<string, string> {
  const out = { ...values };

  if (out.dob) out.dob = normaliseDate(out.dob);
  if (out.admissionDate) out.admissionDate = normaliseDate(out.admissionDate);
  if (out.gender) out.gender = normaliseGender(out.gender);
  if (out.category) out.category = normaliseCategory(out.category);

  return out;
}

/**
 * Indian spreadsheets are overwhelmingly DD/MM/YYYY. An ambiguous 03/04/2010
 * is read as 3 April, which is right far more often than the alternative;
 * anything with a day above 12 confirms the order either way.
 */
export function normaliseDate(input: string): string {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = Number(y) > 30 ? `19${y}` : `20${y}`;
    // If the first part cannot be a month, it is certainly the day.
    const day = Number(a) > 12 ? a : a;
    const month = Number(a) > 12 ? b : b;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? s : parsed.toISOString().slice(0, 10);
}

export function normaliseGender(input: string): string {
  const s = input.trim().toLowerCase();
  if (["m", "male", "boy", "मुलगा", "पुरुष", "1"].includes(s)) return "male";
  if (["f", "female", "girl", "मुलगी", "स्त्री", "2"].includes(s)) return "female";
  if (!s) return "";
  return "other";
}

export function normaliseCategory(input: string): string {
  const s = input.trim().toUpperCase().replace(/[\s.]/g, "");
  if ((CATEGORIES as readonly string[]).includes(s)) return s;
  const map: Record<string, string> = {
    GEN: "OPEN", GENERAL: "OPEN", OP: "OPEN", खुला: "OPEN",
    SCHEDULEDCASTE: "SC", SCHEDULEDTRIBE: "ST",
    OBCNT: "OBC", NT: "VJNT", VJ: "VJNT", VJDT: "VJNT",
  };
  return map[s] ?? input.trim();
}
