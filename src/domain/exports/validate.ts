/**
 * Pre-flight validation for government uploads.
 *
 * This is the feature that saves the weeks. The portal rejects a file with an
 * error report that names row numbers in the uploaded workbook, not students,
 * and often only reports the first failure per row. A school then spends days
 * bouncing a file back and forth in the last week of September.
 *
 * Catching it here — grouped by problem, linked to the student, before
 * anything is uploaded — is the whole point.
 *
 * Pure, so it runs in tests, in the dashboard's readiness count, and in the
 * export screen without a database.
 */
import { CATEGORIES } from "@/domain/students/schema";
import { ageAtAdmission, isPlausibleAgeForClass } from "@/domain/students/schema";
import type { ExportTemplate } from "./mapper";

export type Severity = "error" | "warning";

export type Issue = {
  code: string;
  severity: Severity;
  /** The column or field a clerk would recognise. */
  field: string;
  message: string;
  studentId: string;
  grNumber: string;
  studentName: string;
};

export type ValidatableRow = {
  studentId: string;
  grNumber: string;
  student: Record<string, unknown>;
  enrollment: { class: string | null; division: string | null; rollNo: number | null };
  school: { udiseCode: string };
};

const DEVANAGARI = /[ऀ-ॿ]/;
/** Indian mobile: ten digits starting 6-9, optionally +91 prefixed. */
const MOBILE = /^(?:\+?91)?[6-9]\d{9}$/;

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function validateForExport(
  rows: ValidatableRow[],
  template: ExportTemplate,
): Issue[] {
  const issues: Issue[] = [];

  // APAAR must be unique within the school. Two students sharing one is the
  // failure that gets a whole file rejected with an unhelpful message.
  const apaarSeen = new Map<string, ValidatableRow[]>();

  for (const row of rows) {
    const s = row.student;
    const name = str(s.nameMr) || str(s.nameEn) || row.grNumber;
    const add = (code: string, severity: Severity, field: string, message: string) =>
      issues.push({
        code,
        severity,
        field,
        message,
        studentId: row.studentId,
        grNumber: row.grNumber,
        studentName: name,
      });

    // --- required columns declared by the template -------------------------
    for (const col of template.columns) {
      if (!col.required) continue;
      const [scope, key] = col.source.split(".");
      const container =
        scope === "student" ? s : scope === "enrollment" ? row.enrollment : row.school;
      const value = str((container as Record<string, unknown>)?.[key]);

      if (value) continue;

      // APAAR gets its own code, because it is the single most common gap and
      // deserves its own instruction rather than a generic "missing field".
      if (col.source === "student.apaarId") {
        add(
          "apaar_missing",
          "error",
          col.header,
          "अपार आयडी नाही — APAAR ID is missing. Generate it on the APAAR portal, then add it here.",
        );
      } else {
        add(
          "required_missing",
          "error",
          col.header,
          `${col.header} is required by the upload and is empty.`,
        );
      }
    }

    // --- APAAR format ------------------------------------------------------
    const apaar = str(s.apaarId);
    if (apaar && !/^\d{12}$/.test(apaar)) {
      add(
        "apaar_format",
        "error",
        "APAAR ID",
        `APAAR ID must be exactly 12 digits; this is ${apaar.length}.`,
      );
    }
    if (apaar) {
      apaarSeen.set(apaar, [...(apaarSeen.get(apaar) ?? []), row]);
    }

    // --- English names -----------------------------------------------------
    for (const [key, label] of [
      ["nameEn", "Student Name"],
      ["fatherNameEn", "Father Name"],
      ["motherNameEn", "Mother Name"],
    ] as const) {
      const value = str(s[key]);
      if (value && DEVANAGARI.test(value)) {
        add(
          "name_en_script",
          "error",
          label,
          `${label} contains Devanagari. The upload accepts English letters only — this is the most common cause of rejection.`,
        );
      }
    }

    // --- category ----------------------------------------------------------
    const category = str(s.category);
    if (category && !(CATEGORIES as readonly string[]).includes(category)) {
      add(
        "category_invalid",
        "error",
        "Social Category",
        `"${category}" is not a recognised category. Use one of ${CATEGORIES.join(", ")}.`,
      );
    }

    // --- age plausibility (warning) ---------------------------------------
    const dob = str(s.dob);
    const cls = str(row.enrollment.class);
    if (dob && cls) {
      const age = ageAtAdmission(dob, new Date().toISOString().slice(0, 10));
      if (!isPlausibleAgeForClass(age, cls)) {
        add(
          "age_implausible",
          "warning",
          "Date of Birth",
          `Age ${age} looks wrong for class ${cls}. Check the year of birth.`,
        );
      }
    }

    // --- mobile (warning) --------------------------------------------------
    const mobile = str(s.mobile);
    if (mobile && !MOBILE.test(mobile.replace(/[\s-]/g, ""))) {
      add(
        "mobile_format",
        "warning",
        "Mobile",
        "Mobile number does not look like a ten-digit Indian number.",
      );
    }

    // --- aadhaar verification flag (warning) ------------------------------
    if (s.aadhaarVerified === false) {
      add(
        "aadhaar_unverified",
        "warning",
        "Aadhaar Verified",
        "Aadhaar is not marked verified. The portal may hold this record for review.",
      );
    }
  }

  // --- duplicates, reported on every row involved --------------------------
  for (const [apaar, group] of apaarSeen) {
    if (group.length < 2) continue;
    for (const row of group) {
      issues.push({
        code: "apaar_duplicate",
        severity: "error",
        field: "APAAR ID",
        message: `APAAR ${apaar} is used by ${group.length} students (GR ${group
          .map((r) => r.grNumber)
          .join(", ")}). Each student must have their own.`,
        studentId: row.studentId,
        grNumber: row.grNumber,
        studentName: str(row.student.nameMr) || row.grNumber,
      });
    }
  }

  return issues;
}

export type IssueGroup = {
  code: string;
  severity: Severity;
  field: string;
  /** One representative message; they differ only by the student's values. */
  message: string;
  count: number;
  rows: Array<{ studentId: string; grNumber: string; studentName: string; message: string }>;
};

export type ValidationSummary = {
  blocked: boolean;
  errorCount: number;
  warningCount: number;
  affectedStudents: number;
  groups: IssueGroup[];
};

/**
 * Groups by problem, not by student.
 *
 * A clerk fixes one kind of problem across many students at a time. Walking
 * student by student means reading the same instruction twenty-five times.
 */
export function summarise(issues: Issue[]): ValidationSummary {
  const byCode = new Map<string, Issue[]>();
  for (const i of issues) byCode.set(i.code, [...(byCode.get(i.code) ?? []), i]);

  const groups: IssueGroup[] = [...byCode.entries()]
    .map(([code, list]) => ({
      code,
      severity: list[0].severity,
      field: list[0].field,
      message: list[0].message,
      count: list.length,
      rows: list.map((i) => ({
        studentId: i.studentId,
        grNumber: i.grNumber,
        studentName: i.studentName,
        message: i.message,
      })),
    }))
    // Errors first, then the largest groups — the biggest win is at the top.
    .sort((a, b) =>
      a.severity === b.severity ? b.count - a.count : a.severity === "error" ? -1 : 1,
    );

  const errorCount = issues.filter((i) => i.severity === "error").length;

  return {
    blocked: errorCount > 0,
    errorCount,
    warningCount: issues.length - errorCount,
    affectedStudents: new Set(issues.map((i) => i.studentId)).size,
    groups,
  };
}
