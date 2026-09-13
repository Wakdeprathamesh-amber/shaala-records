/**
 * Marathi inflects for gender. A certificate that says "त्याची" for a girl is
 * wrong in a way a parent notices immediately, and a slashed "त्याची / तिची"
 * on a printed document looks like an unfinished form.
 */
import { describe, expect, it } from "vitest";

import { g, he, his, hisF, honorific, toThem } from "@/lib/marathi/gender";

describe("gendered forms", () => {
  it.each([
    ["honorific", honorific, "कुमार", "कुमारी"],
    ["he/she", he, "हा", "ही"],
    ["his/her (neuter)", his, "त्याचे", "तिचे"],
    ["his/her (feminine)", hisF, "त्याची", "तिची"],
    ["dative", toThem, "त्याला", "तिला"],
  ])("%s picks the right form", (_label, fn, m, f) => {
    expect(fn("male")).toBe(m);
    expect(fn("female")).toBe(f);
  });

  it("prints both when gender is not recorded", () => {
    // Better an unfilled form than a wrong grammatical gender on a child's
    // certificate.
    expect(hisF(null)).toBe("त्याची / तिची");
    expect(hisF(undefined)).toBe("त्याची / तिची");
  });

  it("prints both for 'other' rather than inventing a third form", () => {
    // Marathi has no established third form on statutory documents.
    expect(honorific("other")).toBe("कुमार / कुमारी");
  });

  it("g() works for any pair a template needs", () => {
    expect(g("female", "होता", "होती")).toBe("होती");
    expect(g("male", "होता", "होती")).toBe("होता");
  });
});
