/**
 * Runs against the real database. Creates two throwaway schools, proves they
 * cannot see each other, and deletes everything it made.
 *
 * Mocked tenant isolation tests prove the mock works. The claim worth making —
 * "one school cannot read another's students" — is a claim about SQL, so it is
 * tested against Postgres.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { academicYears, auditLog, enrollments, schools, students, users } from "@/db/schema";
import type { Ctx } from "@/lib/tenant";
import * as repo from "@/domain/students/repo";
import { hashPassword } from "@/lib/auth/password";

const MARKER = `itest-${Date.now()}`;
let ctxA: Ctx;
let ctxB: Ctx;
const schoolIds: string[] = [];

async function makeSchool(suffix: string): Promise<Ctx> {
  const [school] = await db
    .insert(schools)
    .values({
      nameMr: `चाचणी शाळा ${suffix}`,
      nameEn: `Test School ${suffix}`,
      udiseCode: `${MARKER}-${suffix}`,
    })
    .returning();
  schoolIds.push(school.id);

  const [year] = await db
    .insert(academicYears)
    .values({
      schoolId: school.id,
      label: "2026-27",
      startDate: "2026-06-15",
      endDate: "2027-04-30",
      isCurrent: true,
    })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      schoolId: school.id,
      name: `Clerk ${suffix}`,
      email: `${MARKER}-${suffix}@test.invalid`,
      role: "clerk",
      passwordHash: await hashPassword("irrelevant-for-this-test"),
    })
    .returning();

  return {
    schoolId: school.id,
    userId: user.id,
    role: "clerk",
    academicYearId: year.id,
  };
}

const student = (over: Partial<Record<string, unknown>> = {}) => ({
  firstNameMr: "चाचणी",
  lastNameMr: "विद्यार्थी",
  firstNameEn: "Test",
  lastNameEn: "Student",
  dob: "2012-04-15",
  gender: "male" as const,
  category: "OPEN",
  nationality: "Indian",
  admissionDate: "2018-06-15",
  admissionClass: "1",
  ...over,
});

beforeAll(async () => {
  ctxA = await makeSchool("A");
  ctxB = await makeSchool("B");
});

afterAll(async () => {
  for (const id of schoolIds) {
    await db.delete(auditLog).where(eq(auditLog.schoolId, id));
    await db.delete(enrollments).where(eq(enrollments.schoolId, id));
    await db.delete(students).where(eq(students.schoolId, id));
    await db.delete(users).where(eq(users.schoolId, id));
    await db.delete(academicYears).where(eq(academicYears.schoolId, id));
  }
  await db.delete(schools).where(inArray(schools.id, schoolIds));
});

describe("GR number allocation", () => {
  it("starts at 1 for an empty school", async () => {
    const s = await repo.create(ctxA, student() as never);
    expect(s.grNumber).toBe("1");
  });

  it("allocates sequentially", async () => {
    const b = await repo.create(ctxA, student() as never);
    const c = await repo.create(ctxA, student() as never);
    expect(b.grNumber).toBe("2");
    expect(c.grNumber).toBe("3");
  });

  it("numbers each school independently", async () => {
    const s = await repo.create(ctxB, student() as never);
    expect(s.grNumber).toBe("1");
  });

  it("never reuses a number under concurrency", async () => {
    // Ten clerks pressing Save at the same instant.
    const before = await repo.list(ctxA, { page: 1 } as never);
    const created = await Promise.all(
      Array.from({ length: 10 }, () => repo.create(ctxA, student() as never)),
    );
    const grs = created.map((s) => s.grNumber);
    expect(new Set(grs).size).toBe(10);
    const after = await repo.list(ctxA, { page: 1 } as never);
    expect(after.total).toBe(before.total + 10);
  });
});

describe("tenant isolation", () => {
  it("byId returns null for another school's student", async () => {
    const mine = await repo.create(ctxA, student() as never);
    expect(await repo.byId(ctxA, mine.id)).not.toBeNull();
    expect(await repo.byId(ctxB, mine.id)).toBeNull();
  });

  it("byGr returns null across tenants even when the number exists in both", async () => {
    const a = await repo.byGr(ctxA, "1");
    const b = await repo.byGr(ctxB, "1");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.id).not.toBe(b!.id);
    expect(a!.schoolId).toBe(ctxA.schoolId);
    expect(b!.schoolId).toBe(ctxB.schoolId);
  });

  it("list never returns another school's students", async () => {
    const { rows } = await repo.list(ctxB, { page: 1 } as never);
    const ids = rows.map((r) => r.id);
    const { rows: aRows } = await repo.list(ctxA, { page: 1 } as never);
    for (const a of aRows) expect(ids).not.toContain(a.id);
  });

  it("update cannot reach across tenants", async () => {
    const mine = await repo.create(ctxA, student({ firstNameEn: "Original" }) as never);
    const result = await repo.update(ctxB, mine.id, { firstNameEn: "Hijacked" } as never);
    expect(result).toBeNull();
    const unchanged = await repo.byId(ctxA, mine.id);
    expect(unchanged!.firstNameEn).toBe("Original");
  });

  it("setStatus cannot reach across tenants", async () => {
    const mine = await repo.create(ctxA, student() as never);
    expect(await repo.setStatus(ctxB, mine.id, "left")).toBeNull();
    expect((await repo.byId(ctxA, mine.id))!.status).toBe("studying");
  });
});

describe("students are never deleted", () => {
  it("setStatus changes status and keeps the row", async () => {
    const s = await repo.create(ctxA, student() as never);
    await repo.setStatus(ctxA, s.id, "tc_issued");
    const after = await repo.byId(ctxA, s.id);
    expect(after).not.toBeNull();
    expect(after!.status).toBe("tc_issued");
    expect(after!.grNumber).toBe(s.grNumber);
  });

  it("exposes no delete function at all", () => {
    expect(Object.keys(repo)).not.toContain("remove");
    expect(Object.keys(repo)).not.toContain("destroy");
    expect(Object.keys(repo)).not.toContain("delete");
  });
});

describe("audit", () => {
  it("writes a row on create and on update", async () => {
    const s = await repo.create(ctxA, student() as never);
    await repo.update(ctxA, s.id, { firstNameEn: "Changed" } as never);
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, s.id));
    const actions = rows.map((r) => r.action).sort();
    expect(actions).toEqual(["create", "update"]);
    expect(rows.every((r) => r.schoolId === ctxA.schoolId)).toBe(true);
    expect(rows.every((r) => r.userId === ctxA.userId)).toBe(true);
  });
});
