import { describe, expect, it } from "vitest";

import {
  applyTransform,
  loadTemplate,
  listTemplates,
  mapRows,
  TemplateError,
  type ExportTemplate,
} from "@/domain/exports/mapper";

const row = {
  student: {
    apaarId: "123456789012",
    nameEn: "Aditya Sanjay Patil",
    nameMr: "आदित्य संजय पाटील",
    fatherNameEn: "Sanjay Patil",
    motherNameEn: "Sanjabai Patil",
    dob: "2010-01-01",
    gender: "male",
    category: "OPEN",
    religion: "हिंदू",
    motherTongue: "मराठी",
    grNumber: "1001",
    admissionDate: "2020-06-15",
    aadhaarVerified: true,
    bloodGroup: "B+",
  },
  enrollment: { class: "10", division: "अ", rollNo: 1 },
  school: { udiseCode: "27251000101" },
};

describe("loadTemplate", () => {
  it("loads the bundled UDISE template", () => {
    const t = loadTemplate("udise-2026-27");
    expect(t.id).toBe("udise-2026-27");
    expect(t.columns.length).toBeGreaterThan(10);
  });

  it("throws for an unknown template id", () => {
    expect(() => loadTemplate("no-such-template")).toThrow(TemplateError);
  });

  it("lists available templates", () => {
    expect(listTemplates().map((t) => t.id)).toContain("udise-2026-27");
  });

  it("rejects a template with an unknown transform at load, not at export", () => {
    // Discovering this while a clerk waits for a file in late September is
    // the worst possible time.
    const bad = {
      id: "bad",
      label: "Bad",
      sheet: "S",
      headerRow: 1,
      columns: [{ header: "X", source: "student.nameEn", transform: "frobnicate" }],
    } as unknown as ExportTemplate;
    expect(() => mapRows([row], bad)).toThrow(TemplateError);
  });

  it("rejects a map: transform naming a table the template does not define", () => {
    const bad = {
      id: "bad",
      label: "Bad",
      sheet: "S",
      headerRow: 1,
      columns: [{ header: "X", source: "student.category", transform: "map:missingTable" }],
    } as unknown as ExportTemplate;
    expect(() => mapRows([row], bad)).toThrow(/missingTable/);
  });
});

describe("transforms", () => {
  const maps = { codes: { OPEN: "1" }, yesNo: { true: "Y", false: "N" } };

  it("date:DD/MM/YYYY", () => {
    expect(applyTransform("2010-01-01", "date:DD/MM/YYYY", maps)).toBe("01/01/2010");
  });

  it("date:YYYY-MM-DD passes through", () => {
    expect(applyTransform("2010-01-01", "date:YYYY-MM-DD", maps)).toBe("2010-01-01");
  });

  it("date:DD-MM-YYYY", () => {
    expect(applyTransform("2010-01-01", "date:DD-MM-YYYY", maps)).toBe("01-01-2010");
  });

  it("upper", () => {
    expect(applyTransform("Aditya Patil", "upper", maps)).toBe("ADITYA PATIL");
  });

  it("map: looks up the named table", () => {
    expect(applyTransform("OPEN", "map:codes", maps)).toBe("1");
  });

  it("map: leaves an unmapped value alone rather than blanking it", () => {
    // Blanking would silently drop data; leaving it through makes the portal
    // reject that one row, which is visible and fixable.
    expect(applyTransform("UNKNOWN", "map:codes", maps)).toBe("UNKNOWN");
  });

  it("map: handles booleans", () => {
    expect(applyTransform(true, "map:yesNo", maps)).toBe("Y");
    expect(applyTransform(false, "map:yesNo", maps)).toBe("N");
  });

  it("leaves an empty value empty rather than transforming it", () => {
    expect(applyTransform(null, "upper", maps)).toBe("");
    expect(applyTransform(undefined, "date:DD/MM/YYYY", maps)).toBe("");
  });
});

describe("mapRows", () => {
  const template = loadTemplate("udise-2026-27");

  it("produces one row per student", () => {
    const rows = mapRows([row, row, row], template);
    expect(rows).toHaveLength(3);
  });

  it("produces a value for every column, in order", () => {
    const [mapped] = mapRows([row], template);
    expect(mapped).toHaveLength(template.columns.length);
  });

  it("applies the declared transforms", () => {
    const [mapped] = mapRows([row], template);
    const at = (header: string) =>
      mapped[template.columns.findIndex((c) => c.header === header)];

    expect(at("Student Name")).toBe("ADITYA SANJAY PATIL");
    expect(at("Date of Birth")).toBe("01/01/2010");
    expect(at("Gender")).toBe("1");
    expect(at("Social Category")).toBe("1");
    expect(at("Aadhaar Verified")).toBe("Y");
  });

  it("keeps the Marathi name untransformed", () => {
    const [mapped] = mapRows([row], template);
    const i = template.columns.findIndex((c) => c.header === "Student Name (Local)");
    expect(mapped[i]).toBe("आदित्य संजय पाटील");
  });

  it("renders a missing optional field as an empty string, never 'null'", () => {
    const sparse = {
      ...row,
      student: { ...row.student, bloodGroup: null, religion: undefined },
    };
    const [mapped] = mapRows([sparse], template);
    expect(mapped).not.toContain("null");
    expect(mapped).not.toContain("undefined");
  });

  it("handles 800 students", () => {
    const rows = mapRows(Array.from({ length: 800 }, () => row), template);
    expect(rows).toHaveLength(800);
  });
});

describe("the bundled UDISE template", () => {
  const t = loadTemplate("udise-2026-27");

  it("never asks for an Aadhaar number", () => {
    // Verification status is a yes/no flag; the number itself is not stored
    // and must not be exportable.
    const sources = t.columns.map((c) => c.source.toLowerCase());
    expect(sources.some((s) => s.includes("aadhaarnumber"))).toBe(false);
    expect(sources.filter((s) => s.includes("aadhaar"))).toEqual(["student.aadhaarverified"]);
  });

  it("declares every map table its columns reference", () => {
    const used = t.columns
      .map((c) => c.transform)
      .filter((x): x is string => Boolean(x?.startsWith("map:")))
      .map((x) => x.slice(4));
    for (const name of used) {
      expect(Object.keys(t.maps ?? {}), `missing map table ${name}`).toContain(name);
    }
  });

  it("marks the fields the portal rejects rows for as required", () => {
    const required = t.columns.filter((c) => c.required).map((c) => c.header);
    expect(required).toContain("APAAR ID");
    expect(required).toContain("Student Name");
    expect(required).toContain("Date of Birth");
    expect(required).toContain("Social Category");
  });
});
