/**
 * The collection template goes to a school weeks before their data comes back.
 * If a header stops being recognised in the meantime, the school's typing
 * arrives as unmapped columns and someone re-keys it by hand.
 *
 * This test is the contract between the sheet we hand out and the importer
 * that has to read it. It fails the moment the two drift apart.
 */
import { describe, expect, it } from "vitest";

import { COLUMNS, buildCsv } from "../../scripts/make-collection-template";
import { guessMapping, normaliseCategory, normaliseDate, normaliseGender } from "@/domain/import/parse";
import { CATEGORIES } from "@/domain/students/schema";

const headers = COLUMNS.map((c) => c.header);

describe("every template column maps to a field", () => {
  const guesses = guessMapping(headers);

  it("leaves no column unmapped", () => {
    const unmapped = guesses.filter((g) => !g.field).map((g) => g.header);
    expect(unmapped).toEqual([]);
  });

  it("maps each column to a distinct field", () => {
    const fields = guesses.map((g) => g.field);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it.each([
    ["जनरल रजिस्टर क्र. / GR No.", "grNumber"],
    ["नाव (मराठी) / First name", "firstNameMr"],
    ["आडनाव (मराठी) / Surname", "lastNameMr"],
    ["First name (English)", "firstNameEn"],
    ["Surname (English)", "lastNameEn"],
    ["जन्मतारीख DD/MM/YYYY / Date of birth", "dob"],
    ["लिंग / Gender", "gender"],
    ["प्रवर्ग / Category", "category"],
    ["प्रवेश दिनांक DD/MM/YYYY / Admission date", "admissionDate"],
    ["जात / Caste", "caste"],
    ["जात प्रमाणपत्र क्र. / Caste certificate no.", "casteCertNo"],
    ["इयत्ता / Class", "class"],
    ["तुकडी / Division", "division"],
    ["जन्म तालुका / Birth taluka", "birthTaluka"],
    ["स्टुडंट आय.डी. / Student ID (SARAL)", "studentId"],
  ])("%s → %s", (header, field) => {
    const g = guessMapping(headers).find((x) => x.header === header);
    expect(g?.field).toBe(field);
  });
});

describe("the example row survives normalisation", () => {
  const byHeader = new Map(COLUMNS.map((c) => [c.header, c.example]));

  it("parses the example date of birth as 22 August 2012", () => {
    expect(normaliseDate(byHeader.get("जन्मतारीख DD/MM/YYYY / Date of birth")!)).toBe("2012-08-22");
  });

  it("parses the example admission date", () => {
    expect(normaliseDate(byHeader.get("प्रवेश दिनांक DD/MM/YYYY / Admission date")!)).toBe("2023-06-15");
  });

  it("recognises the Marathi gender the sheet asks for", () => {
    expect(normaliseGender(byHeader.get("लिंग / Gender")!)).toBe("male");
    expect(normaliseGender("मुलगी")).toBe("female");
  });

  it("uses a category the schema accepts", () => {
    const c = normaliseCategory(byHeader.get("प्रवर्ग / Category")!);
    expect(CATEGORIES as readonly string[]).toContain(c);
  });
});

describe("the CSV file itself", () => {
  const csv = buildCsv();

  it("starts with a UTF-8 BOM, or Excel on Windows renders Devanagari as mojibake", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("has exactly a header row and one example row", () => {
    expect(csv.trimEnd().split("\n")).toHaveLength(2);
  });

  it("quotes any field containing a comma", () => {
    // The previous-school example has one; an unquoted comma would shift every
    // later column by one and nobody would notice until the wrong data landed.
    expect(csv).toContain('"जिल्हा परिषद प्राथमिक शाळा, रावडी"');
  });

  it("marks exactly the fields the schema refuses to do without", () => {
    expect(COLUMNS.filter((c) => c.required).map((c) => c.header)).toEqual([
      "जनरल रजिस्टर क्र. / GR No.",
      "नाव (मराठी) / First name",
      "आडनाव (मराठी) / Surname",
      "First name (English)",
      "Surname (English)",
      "जन्मतारीख DD/MM/YYYY / Date of birth",
      "लिंग / Gender",
      "प्रवर्ग / Category",
      "प्रवेश दिनांक DD/MM/YYYY / Admission date",
    ]);
  });
});
