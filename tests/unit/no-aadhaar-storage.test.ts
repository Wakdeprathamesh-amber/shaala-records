/**
 * Aadhaar numbers are never accepted or stored — not in a column, not in a
 * JSON blob, not in an import staging row. See AGENTS.md.
 *
 * The reason is not squeamishness. A register of children's Aadhaar numbers
 * makes the school a data fiduciary under the DPDP Act, with breach
 * notification and erasure duties a school office cannot realistically meet,
 * and that exposure sits with the school rather than with us. The client's
 * printed leaving certificate does carry the field, so we print the label with
 * a ruled blank and the clerk writes it in afterwards.
 *
 * This test exists because the pressure to "just add a column" arrives with a
 * real form in hand, which is exactly when it looks reasonable.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const schema = readFileSync("src/db/schema.ts", "utf8");

/** Column names declared anywhere in the schema, e.g. text("student_id"). */
function declaredColumns(src: string): string[] {
  return [...src.matchAll(/\b(?:text|varchar|integer|bigint|jsonb|uuid)\("([\w_]+)"/g)].map(
    (m) => m[1],
  );
}

describe("the schema stores no Aadhaar number", () => {
  const columns = declaredColumns(schema);

  it("declares no column that looks like an Aadhaar number", () => {
    const offenders = columns.filter(
      (c) => /aadhaar|aadhar|adhaar|uid_?(no|num)/i.test(c) && !/verified$/.test(c),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps only the verified flag, which is a boolean and not a number", () => {
    // The government upload asks whether Aadhaar has been verified. Answering
    // that does not require holding the number.
    expect(schema).toContain('aadhaarVerified: boolean("aadhaar_verified")');
    expect(columns).not.toContain("aadhaar_number");
  });

  it("has no Aadhaar field in the student validation schema", () => {
    const students = readFileSync("src/domain/students/schema.ts", "utf8");
    expect(students).not.toMatch(/aadhaar\w*\s*:\s*z\./i);
  });

  it("does not let the importer map a column onto one", () => {
    const parse = readFileSync("src/domain/import/parse.ts", "utf8");
    // A spreadsheet with an "Aadhaar" column must simply not match anything,
    // rather than quietly landing in a staging row.
    expect(parse).not.toMatch(/aadhaar(?!verified)/i);
  });
});
