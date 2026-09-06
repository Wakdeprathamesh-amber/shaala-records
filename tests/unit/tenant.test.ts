import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

import { scoped, type Ctx } from "@/lib/tenant";
import { students } from "@/db/schema";

const dialect = new PgDialect();
const render = (s: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(s);

const ctx: Ctx = {
  schoolId: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
  role: "clerk",
  academicYearId: "33333333-3333-3333-3333-333333333333",
};

describe("scoped()", () => {
  it("always constrains by school_id", () => {
    const { sql, params } = render(scoped(students, ctx));
    expect(sql).toContain('"school_id"');
    expect(params).toContain(ctx.schoolId);
  });

  it("ANDs the tenant predicate with the caller's own condition", () => {
    const { sql, params } = render(
      scoped(students, ctx, eq(students.grNumber, "1042")),
    );
    expect(sql).toContain('"school_id"');
    expect(sql).toContain('"gr_number"');
    expect(sql.toLowerCase()).toContain(" and ");
    expect(params).toEqual([ctx.schoolId, "1042"]);
  });

  it("puts the tenant predicate first, so it cannot be short-circuited away", () => {
    const { sql } = render(scoped(students, ctx, eq(students.grNumber, "1042")));
    expect(sql.indexOf('"school_id"')).toBeLessThan(sql.indexOf('"gr_number"'));
  });

  it("scopes a different school to a different value", () => {
    const other: Ctx = { ...ctx, schoolId: "99999999-9999-9999-9999-999999999999" };
    const a = render(scoped(students, ctx)).params[0];
    const b = render(scoped(students, other)).params[0];
    expect(a).not.toEqual(b);
  });
});

describe("hasRole()", () => {
  it("lets a principal do clerk-level work", async () => {
    const { hasRole } = await import("@/lib/tenant");
    expect(hasRole({ ...ctx, role: "principal" }, "clerk")).toBe(true);
  });

  it("does not let a clerk do principal-level work", async () => {
    const { hasRole } = await import("@/lib/tenant");
    expect(hasRole({ ...ctx, role: "clerk" }, "principal")).toBe(false);
  });

  it("lets a clerk do clerk-level work", async () => {
    const { hasRole } = await import("@/lib/tenant");
    expect(hasRole({ ...ctx, role: "clerk" }, "clerk")).toBe(true);
  });
});
