/**
 * Filter values come from the URL — bookmarked, hand-edited, or forwarded by
 * a colleague months after an option changed. An unrecognised value must be
 * ignored, never turned into a 500. This test exists because the first
 * version did exactly that.
 */
import { describe, expect, it } from "vitest";

import { StudentFilterSchema, activeFilters } from "@/domain/students/schema";

describe("StudentFilterSchema is lenient", () => {
  it("parses valid values", () => {
    const f = StudentFilterSchema.parse({
      gender: "female",
      category: "OBC",
      division: "अ",
      sort: "name",
      dir: "desc",
      page: "3",
    });
    expect(f).toMatchObject({ gender: "female", category: "OBC", sort: "name", dir: "desc", page: 3 });
  });

  it("drops an unknown gender rather than throwing", () => {
    expect(StudentFilterSchema.parse({ gender: "alien" }).gender).toBeUndefined();
  });

  it("drops an unknown category", () => {
    expect(StudentFilterSchema.parse({ category: "XYZ" }).category).toBeUndefined();
  });

  it("drops an unknown status", () => {
    expect(StudentFilterSchema.parse({ status: "deleted" }).status).toBeUndefined();
  });

  it("falls back to the default sort and direction", () => {
    const f = StudentFilterSchema.parse({ sort: "bogus", dir: "sideways" });
    expect(f.sort).toBe("gr");
    expect(f.dir).toBe("asc");
  });

  it("falls back to page 1 for nonsense or negative pages", () => {
    expect(StudentFilterSchema.parse({ page: "abc" }).page).toBe(1);
    expect(StudentFilterSchema.parse({ page: "-3" }).page).toBe(1);
    expect(StudentFilterSchema.parse({ page: "0" }).page).toBe(1);
  });

  it("never throws for any garbage input", () => {
    expect(() =>
      StudentFilterSchema.parse({ gender: 42, category: null, sort: {}, dir: [], page: "x" }),
    ).not.toThrow();
  });
});

describe("activeFilters", () => {
  it("counts only the filters that are set", () => {
    expect(activeFilters({ gender: "female", category: "OBC", sort: "name", page: 2 })).toEqual([
      "gender",
      "category",
    ]);
  });

  it("ignores empty strings", () => {
    expect(activeFilters({ search: "", class: "5" })).toEqual(["class"]);
  });

  it("does not count sort, direction or page as filters", () => {
    expect(activeFilters({ sort: "dob", dir: "desc", page: 4 })).toEqual([]);
  });
});
