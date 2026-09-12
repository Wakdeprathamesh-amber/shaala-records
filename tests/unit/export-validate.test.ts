import { describe, expect, it } from "vitest";

import { loadTemplate } from "@/domain/exports/mapper";
import { validateForExport, summarise, type ValidatableRow } from "@/domain/exports/validate";

const template = loadTemplate("udise-2026-27");

const ok: ValidatableRow = {
  studentId: "s1",
  grNumber: "1001",
  student: {
    apaarId: "123456789012",
    nameEn: "Aditya Sanjay Patil",
    nameMr: "आदित्य संजय पाटील",
    firstNameEn: "Aditya",
    lastNameEn: "Patil",
    fatherNameEn: "Sanjay Patil",
    motherNameEn: "Sanjabai Patil",
    dob: "2010-01-01",
    gender: "male",
    category: "OPEN",
    grNumber: "1001",
    admissionDate: "2020-06-15",
    aadhaarVerified: true,
  },
  enrollment: { class: "10", division: "अ", rollNo: 1 },
  school: { udiseCode: "27251000101" },
};

const run = (rows: ValidatableRow[]) => validateForExport(rows, template);

describe("blocking errors", () => {
  it("passes a complete record", () => {
    const issues = run([ok]);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("flags a missing APAAR ID", () => {
    const issues = run([{ ...ok, student: { ...ok.student, apaarId: null } }]);
    expect(issues.some((i) => i.severity === "error" && i.code === "apaar_missing")).toBe(true);
  });

  it("flags an APAAR that is not 12 digits", () => {
    const issues = run([{ ...ok, student: { ...ok.student, apaarId: "12345" } }]);
    expect(issues.some((i) => i.code === "apaar_format")).toBe(true);
  });

  it("flags Devanagari in an English name", () => {
    const issues = run([{ ...ok, student: { ...ok.student, nameEn: "आदित्य पाटील" } }]);
    expect(issues.some((i) => i.code === "name_en_script")).toBe(true);
  });

  it("flags a missing English name", () => {
    const issues = run([{ ...ok, student: { ...ok.student, nameEn: "" } }]);
    expect(issues.some((i) => i.code === "required_missing")).toBe(true);
  });

  it("flags an invalid category", () => {
    const issues = run([{ ...ok, student: { ...ok.student, category: "GENERAL" } }]);
    expect(issues.some((i) => i.code === "category_invalid")).toBe(true);
  });

  it("flags a duplicate APAAR within the school", () => {
    const other = { ...ok, studentId: "s2", grNumber: "1002" };
    const issues = run([ok, other]);
    const dup = issues.filter((i) => i.code === "apaar_duplicate");
    // Both rows are reported, so either can be opened and fixed.
    expect(dup).toHaveLength(2);
    expect(dup.every((i) => i.severity === "error")).toBe(true);
  });

  it("does not flag two students who both lack an APAAR as duplicates", () => {
    const a = { ...ok, student: { ...ok.student, apaarId: null } };
    const b = { ...ok, studentId: "s2", grNumber: "1002", student: { ...ok.student, apaarId: null } };
    expect(run([a, b]).some((i) => i.code === "apaar_duplicate")).toBe(false);
  });

  it("flags a missing class", () => {
    const issues = run([{ ...ok, enrollment: { class: "", division: null, rollNo: null } }]);
    expect(issues.some((i) => i.code === "required_missing" && i.field === "Class")).toBe(true);
  });

  it("reports the student so the report can link to them", () => {
    const [issue] = run([{ ...ok, student: { ...ok.student, apaarId: null } }]);
    expect(issue.studentId).toBe("s1");
    expect(issue.grNumber).toBe("1001");
  });
});

describe("warnings", () => {
  it("warns about an implausible age for the class without blocking", () => {
    const issues = run([
      { ...ok, student: { ...ok.student, dob: "1990-01-01" }, enrollment: { ...ok.enrollment, class: "1" } },
    ]);
    const age = issues.find((i) => i.code === "age_implausible");
    expect(age).toBeTruthy();
    expect(age!.severity).toBe("warning");
  });

  it("warns about a malformed mobile number", () => {
    const issues = run([{ ...ok, student: { ...ok.student, mobile: "12345" } }]);
    const m = issues.find((i) => i.code === "mobile_format");
    expect(m?.severity).toBe("warning");
  });

  it("accepts a valid Indian mobile", () => {
    const issues = run([{ ...ok, student: { ...ok.student, mobile: "9822012345" } }]);
    expect(issues.some((i) => i.code === "mobile_format")).toBe(false);
  });

  it("warns when Aadhaar is unverified without blocking", () => {
    const issues = run([{ ...ok, student: { ...ok.student, aadhaarVerified: false } }]);
    const a = issues.find((i) => i.code === "aadhaar_unverified");
    expect(a?.severity).toBe("warning");
  });
});

describe("summarise", () => {
  it("groups by problem rather than by student", () => {
    // A clerk fixes one kind of problem across many students at a time;
    // walking student by student means re-reading the same instruction
    // twenty-five times.
    const rows = Array.from({ length: 5 }, (_, i) => ({
      ...ok,
      studentId: `s${i}`,
      grNumber: String(1000 + i),
      student: { ...ok.student, apaarId: null },
    }));
    const s = summarise(run(rows));
    const group = s.groups.find((g) => g.code === "apaar_missing");
    expect(group?.count).toBe(5);
    expect(group?.rows).toHaveLength(5);
  });

  it("blocks export while any error remains", () => {
    const s = summarise(run([{ ...ok, student: { ...ok.student, apaarId: null } }]));
    expect(s.blocked).toBe(true);
    expect(s.errorCount).toBeGreaterThan(0);
  });

  it("does not block on warnings alone", () => {
    const s = summarise(run([{ ...ok, student: { ...ok.student, aadhaarVerified: false } }]));
    expect(s.blocked).toBe(false);
    expect(s.warningCount).toBeGreaterThan(0);
  });

  it("reports a clean set as ready", () => {
    const s = summarise(run([ok]));
    expect(s.blocked).toBe(false);
    expect(s.errorCount).toBe(0);
  });
});
