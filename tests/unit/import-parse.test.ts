import { describe, expect, it } from "vitest";

import {
  applyMapping,
  findHeaderRow,
  guessMapping,
  normaliseCategory,
  normaliseDate,
  normaliseGender,
  normaliseValues,
} from "@/domain/import/parse";

describe("guessMapping", () => {
  it("maps obvious English headers", () => {
    const g = guessMapping(["GR No", "First Name", "Surname", "DOB", "Gender"]);
    expect(g.map((x) => x.field)).toEqual([
      "grNumber",
      "firstNameEn",
      "lastNameEn",
      "dob",
      "gender",
    ]);
  });

  it("maps Marathi headers", () => {
    const g = guessMapping(["जनरल रजिस्टर क्र", "नाव", "आडनाव", "जन्मतारीख", "इयत्ता"]);
    expect(g.map((x) => x.field)).toEqual([
      "grNumber",
      "firstNameMr",
      "lastNameMr",
      "dob",
      "class",
    ]);
  });

  it("ignores a column it does not recognise", () => {
    const g = guessMapping(["GR No", "Favourite Colour"]);
    expect(g[1].field).toBeNull();
  });

  it("never assigns one field to two columns", () => {
    // A sheet with both "Name" and "Student Name" must not map both.
    const g = guessMapping(["Name", "Student Name", "Surname"]);
    const fields = g.map((x) => x.field).filter(Boolean);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it("tolerates punctuation and casing", () => {
    const g = guessMapping(["G.R. No.", "D.O.B", "ROLL NO"]);
    expect(g.map((x) => x.field)).toEqual(["grNumber", "dob", "rollNo"]);
  });

  it("reports confidence so the UI can flag weak guesses", () => {
    const g = guessMapping(["GR No"]);
    expect(g[0].confidence).toBeGreaterThan(0.6);
  });
});

describe("findHeaderRow", () => {
  it("finds headers below a title banner", () => {
    const rows = [
      ["जिल्हा परिषद शाळा, वडगाव", "", "", ""],
      ["", "", "", ""],
      ["GR No", "First Name", "Surname", "DOB"],
      ["1001", "Aditya", "Patil", "01/01/2010"],
    ];
    expect(findHeaderRow(rows)).toBe(2);
  });

  it("returns 0 when the first row is already the header", () => {
    expect(findHeaderRow([["GR No", "First Name"], ["1", "A"]])).toBe(0);
  });

  it("defaults to 0 when nothing looks like a header", () => {
    expect(findHeaderRow([["a", "b"], ["c", "d"]])).toBe(0);
  });
});

describe("applyMapping", () => {
  const rows = [
    ["GR No", "First Name", "Surname"],
    ["1001", "Aditya", "Patil"],
    ["", "", ""],
    ["1002", "Sneha", "Jadhav"],
  ];

  it("produces one staged row per data row", () => {
    const staged = applyMapping(rows, guessMapping(rows[0]), 0);
    expect(staged).toHaveLength(2);
  });

  it("skips wholly blank separator rows", () => {
    const staged = applyMapping(rows, guessMapping(rows[0]), 0);
    expect(staged.map((s) => s.values.grNumber)).toEqual(["1001", "1002"]);
  });

  it("records the original row number so errors point at the sheet", () => {
    const staged = applyMapping(rows, guessMapping(rows[0]), 0);
    expect(staged[0].rowNumber).toBe(2);
    expect(staged[1].rowNumber).toBe(4);
  });
});

describe("normaliseDate", () => {
  it("keeps ISO dates", () => {
    expect(normaliseDate("2010-01-15")).toBe("2010-01-15");
  });

  it("reads DD/MM/YYYY, the Indian convention", () => {
    expect(normaliseDate("15/01/2010")).toBe("2010-01-15");
  });

  it("reads DD-MM-YYYY", () => {
    expect(normaliseDate("15-01-2010")).toBe("2010-01-15");
  });

  it("expands a two-digit year sensibly", () => {
    expect(normaliseDate("15/01/10")).toBe("2010-01-15");
    expect(normaliseDate("15/01/95")).toBe("1995-01-15");
  });

  it("leaves something unparseable alone rather than inventing a date", () => {
    // A wrong date of birth on a certificate is worse than a blocked import.
    expect(normaliseDate("not a date")).toBe("not a date");
  });
});

describe("normaliseGender", () => {
  it.each([
    ["M", "male"], ["male", "male"], ["मुलगा", "male"],
    ["F", "female"], ["Female", "female"], ["मुलगी", "female"],
  ])("%s → %s", (input, expected) => {
    expect(normaliseGender(input)).toBe(expected);
  });

  it("returns empty for empty", () => {
    expect(normaliseGender("")).toBe("");
  });
});

describe("normaliseCategory", () => {
  it.each([
    ["GEN", "OPEN"], ["General", "OPEN"], ["open", "OPEN"],
    ["SC", "SC"], ["NT", "VJNT"], ["VJ", "VJNT"],
  ])("%s → %s", (input, expected) => {
    expect(normaliseCategory(input)).toBe(expected);
  });

  it("passes an unrecognised value through for the clerk to fix", () => {
    expect(normaliseCategory("Xyz")).toBe("Xyz");
  });
});

describe("normaliseValues", () => {
  it("normalises the fields that need it and leaves the rest", () => {
    const out = normaliseValues({
      dob: "15/01/2010",
      gender: "M",
      category: "GEN",
      firstNameEn: "Aditya",
    });
    expect(out).toEqual({
      dob: "2010-01-15",
      gender: "male",
      category: "OPEN",
      firstNameEn: "Aditya",
    });
  });
});
