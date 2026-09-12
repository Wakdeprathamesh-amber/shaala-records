/**
 * The plan's acceptance test: a file with 3 bad rows out of 200 commits 197
 * and reports 3; re-importing the same file commits 0 more.
 *
 * Idempotency is the property worth proving against a real database. Clerks
 * re-run imports — the first attempt timed out, or they are unsure it worked —
 * and a second run that duplicates the school is unrecoverable without
 * knowing which copy is which.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  academicYears, auditLog, enrollments, importBatches, importRows,
  schools, students, users,
} from "@/db/schema";
import type { Ctx } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth/password";
import { commitBatch, validateStaged } from "@/domain/import/commit";
import { createBatch } from "@/domain/import/repo";
import type { StagedRow } from "@/domain/import/parse";
import * as studentRepo from "@/domain/students/repo";

const schoolIds: string[] = [];
let ctx: Ctx;

function makeRow(i: number, broken = false): StagedRow {
  return {
    rowNumber: i + 2,
    values: {
      grNumber: String(5000 + i),
      firstNameMr: "आदित्य",
      lastNameMr: "पाटील",
      // A broken row carries Devanagari in the English name field, which is
      // the most common real defect in a school's existing spreadsheet.
      firstNameEn: broken ? "आदित्य" : "Aditya",
      lastNameEn: "Patil",
      dob: "15/01/2010",
      gender: "M",
      category: "GEN",
      admissionDate: "15/06/2018",
      admissionClass: "1",
      class: "10",
      division: "अ",
      rollNo: String(i + 1),
    },
  };
}

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ nameMr: "आयात चाचणी", nameEn: "Import Test", udiseCode: "27251000888" })
    .returning();
  schoolIds.push(school.id);

  const [year] = await db
    .insert(academicYears)
    .values({ schoolId: school.id, label: "2026-27", startDate: "2026-06-15", endDate: "2027-04-30", isCurrent: true })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      schoolId: school.id, name: "Clerk", email: `import-${Date.now()}@test.invalid`,
      role: "clerk", passwordHash: await hashPassword("irrelevant"),
    })
    .returning();

  ctx = { schoolId: school.id, userId: user.id, role: "clerk", academicYearId: year.id };
});

afterAll(async () => {
  for (const id of schoolIds) {
    await db.delete(auditLog).where(eq(auditLog.schoolId, id));
    await db.delete(importRows).where(eq(importRows.schoolId, id));
    await db.delete(importBatches).where(eq(importBatches.schoolId, id));
    await db.delete(enrollments).where(eq(enrollments.schoolId, id));
    await db.delete(students).where(eq(students.schoolId, id));
    await db.delete(users).where(eq(users.schoolId, id));
    await db.delete(academicYears).where(eq(academicYears.schoolId, id));
  }
  await db.delete(schools).where(inArray(schools.id, schoolIds));
});

describe("a file with 3 bad rows out of 200", () => {
  const rows = Array.from({ length: 200 }, (_, i) => makeRow(i, i === 10 || i === 50 || i === 199));

  it("commits 197 and reports 3", async () => {
    const batch = await createBatch(ctx, "roll.xlsx", rows, {});
    const validated = await validateStaged(ctx, rows);

    expect(validated.filter((v) => Object.keys(v.errors).length > 0)).toHaveLength(3);

    const result = await commitBatch(ctx, batch.id, validated);
    expect(result.inserted).toBe(197);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(3);
    expect(result.failures).toHaveLength(3);
  });

  it("names the rows that failed, by their line in the sheet", async () => {
    const validated = await validateStaged(ctx, rows);
    const failed = validated.filter((v) => Object.keys(v.errors).length > 0);
    expect(failed.map((f) => f.rowNumber)).toEqual([12, 52, 201]);
    expect(failed[0].errors.firstNameEn).toMatch(/English/);
  });

  it("normalised the spreadsheet's formats on the way in", async () => {
    const s = await studentRepo.byGr(ctx, "5000");
    expect(s).not.toBeNull();
    expect(s!.dob).toBe("2010-01-15");   // from 15/01/2010
    expect(s!.gender).toBe("male");       // from "M"
    expect(s!.category).toBe("OPEN");     // from "GEN"
  });

  it("created the enrolments too", async () => {
    const s = await studentRepo.byGr(ctx, "5000");
    const history = await studentRepo.enrollmentHistory(ctx, s!.id);
    expect(history[0].class).toBe("10");
    expect(history[0].rollNo).toBe(1);
  });
});

describe("re-importing the same file", () => {
  const rows = Array.from({ length: 200 }, (_, i) => makeRow(i, i === 10 || i === 50 || i === 199));

  it("commits 0 new students", async () => {
    const before = (await studentRepo.list(ctx, { page: 1 } as never)).total;

    const batch = await createBatch(ctx, "roll.xlsx", rows, {});
    const validated = await validateStaged(ctx, rows);
    const result = await commitBatch(ctx, batch.id, validated);

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(197);

    const after = (await studentRepo.list(ctx, { page: 1 } as never)).total;
    expect(after).toBe(before);
  });

  it("does not duplicate enrolments", async () => {
    const s = await studentRepo.byGr(ctx, "5000");
    const history = await studentRepo.enrollmentHistory(ctx, s!.id);
    expect(history).toHaveLength(1);
  });
});

describe("a GR number repeated inside one file", () => {
  it("is reported rather than silently overwriting", async () => {
    const dup: StagedRow[] = [
      { ...makeRow(900), values: { ...makeRow(900).values, grNumber: "7777" } },
      { ...makeRow(901), values: { ...makeRow(901).values, grNumber: "7777" } },
    ];
    const validated = await validateStaged(ctx, dup);
    expect(validated[1].errors.grNumber).toMatch(/also appears on row/);
  });
});

describe("a file where every row is broken", () => {
  it("commits nothing and marks the batch failed", async () => {
    const allBad = [makeRow(800, true), makeRow(801, true)];
    const batch = await createBatch(ctx, "bad.xlsx", allBad, {});
    const validated = await validateStaged(ctx, allBad);
    const result = await commitBatch(ctx, batch.id, validated);

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(2);

    const [after] = await db
      .select({ status: importBatches.status })
      .from(importBatches)
      .where(eq(importBatches.id, batch.id));
    expect(after.status).toBe("failed");
  });
});
