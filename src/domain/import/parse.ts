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
  studentId: ["student id", "saral id", "saral", "स्टुडंट आयडी", "स्टुडंट आय डी"],
  casteCertNo: ["caste certificate", "caste cert no", "जात प्रमाणपत्र"],
  nationality: ["nationality", "राष्ट्रीयत्व"],
  previousSchool: ["previous school", "last school", "मागील शाळा", "मागील शाळेचे नाव"],
  lastClassPassed: ["last class passed", "मागील इयत्ता", "मागील उत्तीर्ण इयत्ता"],
  class: ["class", "standard", "std", "इयत्ता"],
  division: ["division", "section", "तुकडी"],
  rollNo: ["roll no", "roll number", "हजेरी क्र", "हजेरी क्रमांक"],
};

function normalise(s: string): string {
  return s.toLowerCase().replace(/[\s._/\\()-]/g, "").trim();
}

/** Scores 0..1 how well a header matches a known alias. */
/**
 * Scores 0..1 how well a header matches a known alias.
 *
 * Substring matches carry a small bonus for how much of the header the alias
 * actually accounts for. Without it, a header like
 * "जात प्रमाणपत्र क्र. / Caste certificate no." scored the same against the
 * one-word alias "जात" (caste) as against "caste certificate", and the tie
 * was broken by whichever field happened to be declared first — filing
 * certificate numbers in the caste column, quietly, on every import.
 *
 * The bonus can never lift a substring match to an exact one, so specificity
 * only ever decides between otherwise equal candidates.
 */
function score(header: string, alias: string): number {
  const h = normalise(header);
  const a = normalise(alias);
  if (!h || !a) return 0;
  if (h === a) return 1;

  const coverage = a.length / Math.max(h.length, a.length);
  if (h.startsWith(a) || a.startsWith(h)) return 0.85 + coverage * 0.1;
  if (h.includes(a) || a.includes(h)) return 0.7 + coverage * 0.1;
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
 * Indian spreadsheets are overwhelmingly DD/MM/YYYY, so an ambiguous
 * 03/04/2010 is read as 3 April. A part above 12 can only be a day and
 * settles the order on its own, whichever way the file was exported.
 */
export function normaliseDate(input: string): string {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [, a, b, rawYear] = m;
    const y = rawYear.length === 2
      ? (Number(rawYear) > 30 ? `19${rawYear}` : `20${rawYear}`)
      : rawYear;

    /*
     * Day/month order.
     *
     * The previous version wrote `Number(a) > 12 ? a : a` for both parts —
     * ternaries that returned the same value either way, so the check it
     * looked like it was making was never made. It happened to behave
     * correctly for Indian sheets and silently mis-read US-exported ones.
     *
     * Decided explicitly now: a value over 12 can only be a day, so it
     * settles the order on its own. When both parts are 12 or under the date
     * is genuinely ambiguous, and Indian school records are written
     * DD/MM/YYYY, so that is the assumption. The collection template asks for
     * DD/MM/YYYY in the column heading for the same reason.
     */
    const [day, month] = Number(b) > 12 ? [b, a] : [a, b];
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
  const raw = input.trim();
  const upper = raw.toUpperCase();
  if ((CATEGORIES as readonly string[]).includes(upper)) return upper;

  // Strip spaces, dots, brackets and hyphens so "VJ (A)", "vj-a" and "NT B"
  // all land on the same key.
  const key = upper.replace(/[\s.()\-]/g, "");
  const map: Record<string, string> = {
    GEN: "OPEN", GENERAL: "OPEN", OP: "OPEN", OPEN: "OPEN", खुला: "OPEN",
    SC: "SC", SCHEDULEDCASTE: "SC",
    ST: "ST", SCHEDULEDTRIBE: "ST",
    VJA: "VJ-A", NTB: "NT-B", NTC: "NT-C", NTD: "NT-D",
    OBC: "OBC", OBCNT: "OBC",
    SBC: "SBC", EWS: "EWS",
  };
  // "VJNT", "VJ" and "NT" on their own are deliberately absent: the old
  // spreadsheets lumped four categories together and there is no honest way
  // to pick one. The value passes through and validation asks the clerk.
  return map[key] ?? raw;
}
