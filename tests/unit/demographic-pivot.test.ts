import { describe, expect, it } from "vitest";

import { buildDemographicTable, sortClasses } from "@/domain/reports/pivot";
import { CATEGORIES } from "@/domain/students/schema";

const cells = [
  { class: "9", category: "OPEN", gender: "male", n: 3 },
  { class: "9", category: "OPEN", gender: "female", n: 2 },
  { class: "10", category: "SC", gender: "female", n: 4 },
  { class: "1", category: "NT-B", gender: "male", n: 1 },
  { class: "10", category: null, gender: "male", n: 1 },
  { class: "10", category: "BOGUS", gender: "other", n: 1 },
];

describe("sortClasses", () => {
  it("orders numerically so 10 follows 9", () => {
    expect(sortClasses(["10", "1", "9", "2"])).toEqual(["1", "2", "9", "10"]);
  });
  it("puts non-numeric classes last, alphabetically", () => {
    expect(sortClasses(["Nursery", "1", "KG"])).toEqual(["1", "KG", "Nursery"]);
  });
});

describe("buildDemographicTable", () => {
  const t = buildDemographicTable(cells);

  it("lists every state category even at zero", () => {
    expect(t.rows.map((r) => r.category)).toEqual([...CATEGORIES]);
    expect(t.rows.find((r) => r.category === "EWS")!.total.t).toBe(0);
  });

  it("splits by gender and totals across", () => {
    const open = t.rows.find((r) => r.category === "OPEN")!;
    expect(open.byClass["9"]).toEqual({ m: 3, f: 2, o: 0, t: 5 });
    expect(open.total.t).toBe(5);
  });

  it("puts blank and unrecognised categories in one visible bucket rather than dropping them", () => {
    expect(t.unknown).not.toBeNull();
    expect(t.unknown!.total.t).toBe(2);
    expect(t.unknown!.byClass["10"].o).toBe(1);
  });

  it("grand total counts everyone, including the unknown bucket", () => {
    expect(t.grand).toEqual({ m: 5, f: 6, o: 1, t: 12 });
  });

  it("has no unknown bucket when every category is valid", () => {
    expect(buildDemographicTable(cells.slice(0, 4)).unknown).toBeNull();
  });

  it("handles an empty school", () => {
    const e = buildDemographicTable([]);
    expect(e.classes).toEqual([]);
    expect(e.grand.t).toBe(0);
    expect(e.rows).toHaveLength(CATEGORIES.length);
  });
});
