import { describe, expect, it } from "vitest";

import {
  ErrorReportError,
  buildIndex,
  matchToStudents,
  parseErrorReport,
  studentIdsToReexport,
  summariseErrors,
} from "@/domain/exports/errorReport";

const index = buildIndex([
  { studentId: "s1", grNumber: "1001", student: { apaarId: "100000000001", nameEn: "Aditya Patil", nameMr: "आदित्य पाटील" } },
  { studentId: "s2", grNumber: "1002", student: { apaarId: "100000000002", nameEn: "Sneha Jadhav", nameMr: "स्नेहा जाधव" } },
  { studentId: "s3", grNumber: "1003", student: { apaarId: null, nameEn: "Rohit Deshmukh", nameMr: "रोहित देशमुख" } },
]);

describe("parseErrorReport", () => {
  it("reads the portal's columns whatever they are called", () => {
    const errors = parseErrorReport(
      ["Sr No", "APAAR ID", "Error Description"],
      [["1", "100000000001", "Invalid date format"]],
    );
    expect(errors).toEqual([
      { rowNumber: 1, identifier: "100000000001", reason: "Invalid date format" },
    ]);
  });

  it("tolerates different header spellings between years", () => {
    const errors = parseErrorReport(
      ["Row No.", "PEN", "Error Message"],
      [["7", "100000000002", "Category mismatch"]],
    );
    expect(errors[0].identifier).toBe("100000000002");
    expect(errors[0].reason).toBe("Category mismatch");
  });

  it("falls back to position when there is no row column", () => {
    const errors = parseErrorReport(
      ["Admission Number", "Remarks"],
      [["1001", "Bad"], ["1002", "Worse"]],
    );
    expect(errors.map((e) => e.rowNumber)).toEqual([2, 3]);
  });

  it("ignores rows with no error text", () => {
    const errors = parseErrorReport(
      ["APAAR ID", "Error"],
      [["100000000001", "Bad"], ["100000000002", ""]],
    );
    expect(errors).toHaveLength(1);
  });

  it("explains itself when it cannot find the error column", () => {
    expect(() => parseErrorReport(["Foo", "Bar"], [["a", "b"]])).toThrow(ErrorReportError);
    expect(() => parseErrorReport(["Foo", "Bar"], [["a", "b"]])).toThrow(/Foo, Bar/);
  });
});

describe("matchToStudents", () => {
  it("matches on APAAR", () => {
    const [m] = matchToStudents(
      [{ rowNumber: 1, identifier: "100000000001", reason: "x" }],
      index,
    );
    expect(m.studentId).toBe("s1");
    expect(m.matchedBy).toBe("apaar");
  });

  it("falls back to GR number", () => {
    const [m] = matchToStudents([{ rowNumber: 1, identifier: "1003", reason: "x" }], index);
    expect(m.studentId).toBe("s3");
    expect(m.matchedBy).toBe("gr");
  });

  it("falls back to English name", () => {
    const [m] = matchToStudents(
      [{ rowNumber: 1, identifier: "Rohit Deshmukh", reason: "x" }],
      index,
    );
    expect(m.studentId).toBe("s3");
    expect(m.matchedBy).toBe("name");
  });

  it("keeps an unmatched row rather than dropping it", () => {
    // Dropping it would leave a child unfixed with nobody aware.
    const [m] = matchToStudents(
      [{ rowNumber: 1, identifier: "999999999999", reason: "x" }],
      index,
    );
    expect(m.studentId).toBeNull();
    expect(m.matchedBy).toBeNull();
    expect(m.identifier).toBe("999999999999");
  });
});

describe("summariseErrors", () => {
  it("groups identical problems together", () => {
    const matched = matchToStudents(
      [
        { rowNumber: 1, identifier: "100000000001", reason: "Invalid date format" },
        { rowNumber: 2, identifier: "100000000002", reason: "Invalid date format" },
        { rowNumber: 3, identifier: "1003", reason: "Category mismatch" },
      ],
      index,
    );
    const s = summariseErrors(matched);
    expect(s.total).toBe(3);
    expect(s.matched).toBe(3);
    expect(s.groups[0].reason).toBe("Invalid date format");
    expect(s.groups[0].count).toBe(2);
  });

  it("groups messages that differ only by the offending value", () => {
    const matched = matchToStudents(
      [
        { rowNumber: 1, identifier: "100000000001", reason: 'Invalid category "GENERAL"' },
        { rowNumber: 2, identifier: "100000000002", reason: 'Invalid category "NONE"' },
      ],
      index,
    );
    expect(summariseErrors(matched).groups).toHaveLength(1);
  });

  it("counts unmatched rows separately", () => {
    const matched = matchToStudents(
      [{ rowNumber: 1, identifier: "nobody", reason: "x" }],
      index,
    );
    const s = summariseErrors(matched);
    expect(s.matched).toBe(0);
    expect(s.unmatched).toBe(1);
  });
});

describe("studentIdsToReexport", () => {
  it("returns only matched students, deduplicated", () => {
    const matched = matchToStudents(
      [
        { rowNumber: 1, identifier: "100000000001", reason: "a" },
        { rowNumber: 2, identifier: "100000000001", reason: "b" },
        { rowNumber: 3, identifier: "nobody", reason: "c" },
      ],
      index,
    );
    expect(studentIdsToReexport(matched)).toEqual(["s1"]);
  });
});
