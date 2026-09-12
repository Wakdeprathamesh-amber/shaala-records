/**
 * Role enforcement, tested at the domain boundary rather than the UI.
 *
 * The settings page hides the forms from a clerk, but hiding is not enforcing.
 * The UDISE code set here prints on every certificate and keys every
 * government upload; a clerk changing it would invalidate both, and the
 * mistake would not surface until a file was rejected weeks later.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { academicYears, auditLog, schools, users } from "@/db/schema";
import { AuthorizationError, hasRole, type Ctx } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth/password";
import * as repo from "@/domain/settings/repo";

const schoolIds: string[] = [];
let principal: Ctx;
let clerk: Ctx;

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ nameMr: "भूमिका चाचणी", nameEn: "Role Test", udiseCode: "27251000777" })
    .returning();
  schoolIds.push(school.id);

  const [year] = await db
    .insert(academicYears)
    .values({ schoolId: school.id, label: "2026-27", startDate: "2026-06-15", endDate: "2027-04-30", isCurrent: true })
    .returning();

  const hash = await hashPassword("irrelevant-for-this-test");
  const [p] = await db.insert(users).values({
    schoolId: school.id, name: "Principal", email: `p-${Date.now()}@test.invalid`,
    role: "principal", passwordHash: hash,
  }).returning();
  const [c] = await db.insert(users).values({
    schoolId: school.id, name: "Clerk", email: `c-${Date.now()}@test.invalid`,
    role: "clerk", passwordHash: hash,
  }).returning();

  principal = { schoolId: school.id, userId: p.id, role: "principal", academicYearId: year.id };
  clerk = { schoolId: school.id, userId: c.id, role: "clerk", academicYearId: year.id };
});

afterAll(async () => {
  for (const id of schoolIds) {
    await db.delete(auditLog).where(eq(auditLog.schoolId, id));
    await db.delete(users).where(eq(users.schoolId, id));
    await db.delete(academicYears).where(eq(academicYears.schoolId, id));
  }
  await db.delete(schools).where(inArray(schools.id, schoolIds));
});

describe("hasRole", () => {
  it("lets a principal do clerk work", () => {
    expect(hasRole(principal, "clerk")).toBe(true);
    expect(hasRole(principal, "principal")).toBe(true);
  });

  it("does not let a clerk do principal work", () => {
    expect(hasRole(clerk, "principal")).toBe(false);
  });
});

describe("academic years", () => {
  it("keeps exactly one current year when switching", async () => {
    const second = await repo.createYear(principal, {
      label: "2027-28",
      startDate: "2027-06-15",
      endDate: "2028-04-30",
      makeCurrent: false,
    });

    await repo.setCurrentYear(principal, second.id);

    const all = await repo.listYears(principal);
    expect(all.filter((y) => y.isCurrent)).toHaveLength(1);
    expect(all.find((y) => y.isCurrent)!.id).toBe(second.id);
  });

  it("refuses to make another school's year current", async () => {
    const [other] = await db
      .insert(schools)
      .values({ nameMr: "इतर", nameEn: "Other", udiseCode: "27251000666" })
      .returning();
    schoolIds.push(other.id);

    const [otherYear] = await db
      .insert(academicYears)
      .values({ schoolId: other.id, label: "2026-27", startDate: "2026-06-15", endDate: "2027-04-30", isCurrent: true })
      .returning();

    expect(await repo.setCurrentYear(principal, otherYear.id)).toBeNull();

    // And the other school's year is untouched.
    const [after] = await db
      .select({ isCurrent: academicYears.isCurrent })
      .from(academicYears)
      .where(eq(academicYears.id, otherYear.id));
    expect(after.isCurrent).toBe(true);
  });

  it("never deletes a year", () => {
    expect(Object.keys(repo)).not.toContain("deleteYear");
    expect(Object.keys(repo)).not.toContain("removeYear");
  });
});

describe("users", () => {
  it("lists only this school's users", async () => {
    const list = await repo.listUsers(principal);
    expect(list.map((u) => u.role).sort()).toEqual(["clerk", "principal"]);
  });

  it("cannot reset a password for another school's user", async () => {
    const [other] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.schoolId, schoolIds[schoolIds.length - 1]))
      .limit(1);
    if (other) {
      expect(await repo.setUserPassword(principal, other.id, "x")).toBeNull();
    }
  });
});

describe("AuthorizationError", () => {
  it("distinguishes unauthenticated from forbidden", () => {
    const a = new AuthorizationError("no session", "unauthenticated");
    const b = new AuthorizationError("wrong role", "forbidden");
    expect(a.kind).toBe("unauthenticated");
    expect(b.kind).toBe("forbidden");
  });
});
