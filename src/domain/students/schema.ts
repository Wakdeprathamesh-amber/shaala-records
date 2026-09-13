/**
 * Validation for the student register. Pure — no database, no server-only —
 * so the rules are directly testable and can also run in the import pipeline.
 *
 * Zod 4 syntax throughout: `z.email()`, `{ error: ... }`.
 */
import * as z from "zod";

/** The fixed Maharashtra social category codes. Anything else is rejected
 *  rather than stored, because the government upload maps from this list and
 *  an unrecognised value fails the whole file. */
export const CATEGORIES = ["OPEN", "SC", "ST", "OBC", "VJNT", "SBC", "EWS"] as const;
export type Category = (typeof CATEGORIES)[number];

export const GENDERS = ["male", "female", "other"] as const;
export const STATUSES = ["studying", "left", "tc_issued"] as const;

/** Devanagari block, plus the punctuation that legitimately appears in names. */
const DEVANAGARI = /^[ऀ-ॿ\s.'’-]+$/;
/** Latin only. A Devanagari character here is the most common single cause of
 *  a UDISE+ upload rejection, so it is caught at entry rather than at export. */
const LATIN = /^[A-Za-z\s.'’-]+$/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const mrName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} आवश्यक आहे — ${label} is required` })
    .max(60)
    .regex(DEVANAGARI, {
      error: `${label} देवनागरीत लिहा — ${label} must be in Marathi script`,
    });

const enName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} (English) is required` })
    .max(60)
    .regex(LATIN, {
      error: `${label} must be in English letters — government uploads reject Devanagari`,
    });

const optionalMr = z
  .string()
  .trim()
  .max(60)
  .regex(DEVANAGARI, { error: "देवनागरीत लिहा — must be in Marathi script" })
  .optional()
  .or(z.literal(""));

const optionalEn = z
  .string()
  .trim()
  .max(60)
  .regex(LATIN, { error: "Must be in English letters" })
  .optional()
  .or(z.literal(""));

const isoDate = z.string().regex(ISO_DATE, { error: "Use YYYY-MM-DD" });

/** Whole years completed on the admission date. */
export function ageAtAdmission(dob: string, admissionDate: string): number {
  const b = new Date(`${dob}T00:00:00Z`);
  const a = new Date(`${admissionDate}T00:00:00Z`);
  let age = a.getUTCFullYear() - b.getUTCFullYear();
  const monthDiff = a.getUTCMonth() - b.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && a.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/**
 * Under Maharashtra RTE a child enters class 1 at six, so expected age is
 * roughly class + 5. The window is deliberately wide — repeated years and
 * late admission are both common and legitimate — and only catches the gross
 * data-entry errors: a year typed as 1988 instead of 2018, a class typed into
 * the age field.
 */
export function isPlausibleAgeForClass(age: number, cls: string): boolean {
  const n = Number.parseInt(cls, 10);
  if (!Number.isFinite(n) || n < 1) return true; // unknown class constrains nothing
  return age >= n + 1 && age <= n + 9;
}

const base = z.object({
  firstNameMr: mrName("नाव"),
  middleNameMr: optionalMr,
  lastNameMr: mrName("आडनाव"),
  firstNameEn: enName("First name"),
  middleNameEn: optionalEn,
  lastNameEn: enName("Surname"),

  dob: isoDate,
  gender: z.enum(GENDERS),

  motherNameMr: optionalMr,
  motherNameEn: optionalEn,
  fatherNameMr: optionalMr,
  fatherNameEn: optionalEn,

  caste: z.string().trim().max(60).optional().or(z.literal("")),
  subCaste: z.string().trim().max(60).optional().or(z.literal("")),
  category: z.enum(CATEGORIES),
  religion: z.string().trim().max(40).optional().or(z.literal("")),
  nationality: z.string().trim().max(40).default("Indian"),
  motherTongue: z.string().trim().max(40).optional().or(z.literal("")),

  birthVillage: z.string().trim().max(80).optional().or(z.literal("")),
  birthTaluka: z.string().trim().max(80).optional().or(z.literal("")),
  birthDistrict: z.string().trim().max(80).optional().or(z.literal("")),
  birthState: z.string().trim().max(80).optional().or(z.literal("")),

  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional()
    .or(z.literal("")),

  admissionDate: isoDate,
  admissionClass: z.string().trim().max(10).optional().or(z.literal("")),
  previousSchool: z.string().trim().max(120).optional().or(z.literal("")),
  lastClassPassed: z.string().trim().max(10).optional().or(z.literal("")),

  /**
   * APAAR is the government's student ID and is exactly 12 digits. It is
   * optional because most students do not have one yet — that gap is what the
   * export pre-flight reports.
   *
   * Note what is absent: there is no Aadhaar field, here or in the database.
   * Zod strips unknown keys by default, so an `aadhaar` value posted to this
   * schema is discarded rather than carried forward.
   */
  apaarId: z
    .string()
    .trim()
    .regex(/^\d{12}$/, { error: "APAAR ID is exactly 12 digits" })
    .optional()
    .or(z.literal("")),
});

/** Cross-field rules that cannot be expressed on a single field. */
function withDateRules<T extends z.ZodType>(schema: T) {
  return schema
    .refine(
      (v: any) => new Date(`${v.dob}T00:00:00Z`) < new Date(),
      { error: "जन्मतारीख भविष्यात असू शकत नाही — Date of birth cannot be in the future", path: ["dob"] },
    )
    .refine(
      (v: any) => v.admissionDate >= v.dob,
      { error: "प्रवेश दिनांक जन्मतारखेनंतर हवा — Admission date must be after date of birth", path: ["admissionDate"] },
    )
    .refine(
      (v: any) =>
        !v.admissionClass ||
        isPlausibleAgeForClass(ageAtAdmission(v.dob, v.admissionDate), v.admissionClass),
      {
        error:
          "या इयत्तेसाठी वय जुळत नाही — Age does not match the admission class; check the year",
        path: ["dob"],
      },
    );
}

export const StudentCreateSchema = withDateRules(base);
export const StudentUpdateSchema = withDateRules(base);

export type StudentInput = z.infer<typeof base>;

export const StatusSchema = z.enum(STATUSES);

export const SORTS = ["gr", "name", "class", "dob", "recent"] as const;
export type Sort = (typeof SORTS)[number];

/** Divisions as Maharashtra schools write them. */
export const DIVISIONS = ["अ", "ब", "क", "ड", "इ"] as const;

/**
 * Lenient on purpose. These values arrive from the URL, which a clerk can
 * edit, bookmark, or receive from a colleague months after an option was
 * renamed. An unrecognised value is ignored rather than turned into a 500 —
 * `.catch()` swaps anything invalid for the default instead of throwing.
 */
export const StudentFilterSchema = z.object({
  search: z.string().trim().max(80).optional().catch(undefined),
  class: z.string().trim().max(10).optional().catch(undefined),
  division: z.string().trim().max(10).optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  gender: z.enum(GENDERS).optional().catch(undefined),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  sort: z.enum(SORTS).default("gr").catch("gr"),
  dir: z.enum(["asc", "desc"]).default("asc").catch("asc"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});
export type StudentFilter = z.infer<typeof StudentFilterSchema>;

/** Which filter keys are active, for a "clear" affordance and a count badge. */
export function activeFilters(f: Partial<StudentFilter>): string[] {
  return (["search", "class", "division", "status", "gender", "category"] as const).filter(
    (k) => f[k] !== undefined && f[k] !== "",
  );
}
