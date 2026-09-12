import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  StudentCreateSchema,
  ageAtAdmission,
  isPlausibleAgeForClass,
} from "@/domain/students/schema";

const valid = {
  firstNameMr: "आदित्य",
  middleNameMr: "संजय",
  lastNameMr: "पाटील",
  firstNameEn: "Aditya",
  middleNameEn: "Sanjay",
  lastNameEn: "Patil",
  dob: "2012-04-15",
  gender: "male" as const,
  category: "OPEN",
  admissionDate: "2018-06-15",
  admissionClass: "1",
};

describe("StudentCreateSchema — names", () => {
  it("accepts a complete record", () => {
    expect(StudentCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("requires the Marathi given name — it is the statutory record", () => {
    const r = StudentCreateSchema.safeParse({ ...valid, firstNameMr: "" });
    expect(r.success).toBe(false);
  });

  it("requires the English given name — government uploads reject Devanagari", () => {
    const r = StudentCreateSchema.safeParse({ ...valid, firstNameEn: "" });
    expect(r.success).toBe(false);
  });

  it("requires both surnames", () => {
    expect(StudentCreateSchema.safeParse({ ...valid, lastNameMr: "" }).success).toBe(false);
    expect(StudentCreateSchema.safeParse({ ...valid, lastNameEn: "" }).success).toBe(false);
  });

  it("rejects Devanagari in an English name field", () => {
    // This is the single most common cause of a UDISE+ upload rejection.
    const r = StudentCreateSchema.safeParse({ ...valid, firstNameEn: "आदित्य" });
    expect(r.success).toBe(false);
  });

  it("allows a missing middle name", () => {
    const r = StudentCreateSchema.safeParse({ ...valid, middleNameMr: "", middleNameEn: "" });
    expect(r.success).toBe(true);
  });
});

describe("StudentCreateSchema — dates", () => {
  it("rejects a date of birth in the future", () => {
    const r = StudentCreateSchema.safeParse({ ...valid, dob: "2099-01-01" });
    expect(r.success).toBe(false);
  });

  it("rejects an admission date before the date of birth", () => {
    const r = StudentCreateSchema.safeParse({
      ...valid,
      dob: "2015-01-01",
      admissionDate: "2014-06-15",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an implausible age for the admission class", () => {
    // Admitted to class 1 at 30 years old.
    const r = StudentCreateSchema.safeParse({
      ...valid,
      dob: "1988-04-15",
      admissionDate: "2018-06-15",
      admissionClass: "1",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a normal age for the admission class", () => {
    // Class 1 at 6 years old.
    const r = StudentCreateSchema.safeParse({
      ...valid,
      dob: "2012-04-15",
      admissionDate: "2018-06-15",
      admissionClass: "1",
    });
    expect(r.success).toBe(true);
  });
});

describe("StudentCreateSchema — category", () => {
  it("accepts every Maharashtra category code", () => {
    for (const c of CATEGORIES) {
      expect(StudentCreateSchema.safeParse({ ...valid, category: c }).success).toBe(true);
    }
  });

  it("rejects a category outside the fixed list", () => {
    expect(StudentCreateSchema.safeParse({ ...valid, category: "GENERAL" }).success).toBe(false);
  });
});

describe("StudentCreateSchema — APAAR", () => {
  it("accepts exactly 12 digits", () => {
    expect(StudentCreateSchema.safeParse({ ...valid, apaarId: "123456789012" }).success).toBe(true);
  });

  it("rejects 11 digits", () => {
    expect(StudentCreateSchema.safeParse({ ...valid, apaarId: "12345678901" }).success).toBe(false);
  });

  it("rejects 13 digits", () => {
    expect(StudentCreateSchema.safeParse({ ...valid, apaarId: "1234567890123" }).success).toBe(false);
  });

  it("rejects letters", () => {
    expect(StudentCreateSchema.safeParse({ ...valid, apaarId: "APAAR1234567" }).success).toBe(false);
  });

  it("allows it to be absent — it is issued later for many students", () => {
    expect(StudentCreateSchema.safeParse({ ...valid, apaarId: undefined }).success).toBe(true);
  });
});

describe("Aadhaar is never accepted", () => {
  // PRD principle: storing Aadhaar makes the school a data fiduciary under
  // DPDP with obligations it cannot meet. The column does not exist; this
  // asserts the input boundary refuses it too.
  it("strips an aadhaar field rather than passing it through", () => {
    const r = StudentCreateSchema.safeParse({ ...valid, aadhaar: "123456789012" });
    expect(r.success).toBe(true);
    expect(r.success && "aadhaar" in r.data).toBe(false);
  });

  it("strips aadhaarNumber too", () => {
    const r = StudentCreateSchema.safeParse({ ...valid, aadhaarNumber: "123456789012" });
    expect(r.success && "aadhaarNumber" in r.data).toBe(false);
  });

  it("has no aadhaar key in the parsed output for a clean record", () => {
    const r = StudentCreateSchema.safeParse(valid);
    const keys = r.success ? Object.keys(r.data).join(",").toLowerCase() : "";
    expect(keys).not.toContain("aadhaar");
  });
});

describe("age helpers", () => {
  it("computes age at admission", () => {
    expect(ageAtAdmission("2012-04-15", "2018-06-15")).toBe(6);
  });

  it("does not count a birthday that has not happened yet", () => {
    expect(ageAtAdmission("2012-08-15", "2018-06-15")).toBe(5);
  });

  it("accepts a six-year-old in class 1", () => {
    expect(isPlausibleAgeForClass(6, "1")).toBe(true);
  });

  it("rejects a thirty-year-old in class 1", () => {
    expect(isPlausibleAgeForClass(30, "1")).toBe(false);
  });

  it("accepts a fifteen-year-old in class 10", () => {
    expect(isPlausibleAgeForClass(15, "10")).toBe(true);
  });

  it("does not constrain when the class is unknown", () => {
    expect(isPlausibleAgeForClass(9, "")).toBe(true);
  });
});
