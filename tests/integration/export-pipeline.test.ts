/**
 * The export pipeline end to end against the real database: read the roll,
 * validate it, write the workbook, read it back.
 *
 * Reading the file back matters. A workbook that writes without throwing can
 * still be unopenable, or can have silently coerced "01/01/2010" into a date
 * and "0042" into the number 42 — both of which the portal rejects with an
 * error message that does not mention formatting.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { academicYears, enrollments, exportRuns, schools, students, users, auditLog } from "@/db/schema";
import type { Ctx } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth/password";
import * as studentRepo from "@/domain/students/repo";
import { loadTemplate } from "@/domain/exports/mapper";
import { rowsForExport } from "@/domain/exports/repo";
import { summarise, validateForExport } from "@/domain/exports/validate";
import { readWorkbook, writeWorkbook } from "@/domain/exports/workbook";

const MARKER = `xtest-${Date.now()}`;
const schoolIds: string[] = [];
let ctx: Ctx;
const template = loadTemplate("udise-2026-27");

const complete = (n: number) => ({
  firstNameMr: "आदित्य",
  lastNameMr: "पाटील",
  firstNameEn: "Aditya",
  lastNameEn: "Patil",
  motherNameEn: "Sanjabai Patil",
  fatherNameEn: "Sanjay Patil",
  motherNameMr: "सौ. संजाबाई पाटील",
  fatherNameMr: "संजय पाटील",
  dob: "2010-01-01",
  gender: "male" as const,
  category: "OPEN",
  nationality: "Indian",
  admissionDate: "2018-06-15",
  admissionClass: "1",
  apaarId: String(100000000000 + n),
});

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ nameMr: "निर्यात चाचणी", nameEn: "Export Test", udiseCode: "27251000999" })
    .returning();
  schoolIds.push(school.id);

  const [year] = await db
    .insert(academicYears)
    .values({ schoolId: school.id, label: "2026-27", startDate: "2026-06-15", endDate: "2027-04-30", isCurrent: true })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      schoolId: school.id, name: "Clerk", email: `${MARKER}@test.invalid`,
      role: "clerk", passwordHash: await hashPassword("irrelevant"),
    })
    .returning();

  ctx = { schoolId: school.id, userId: user.id, role: "clerk", academicYearId: year.id };

  for (let i = 0; i < 5; i++) {
    const s = await studentRepo.create(ctx, complete(i) as never);
    await studentRepo.upsertEnrollment(ctx, s.id, { class: "10", division: "अ", rollNo: i + 1 });
  }
});

afterAll(async () => {
  for (const id of schoolIds) {
    await db.delete(auditLog).where(eq(auditLog.schoolId, id));
    await db.delete(exportRuns).where(eq(exportRuns.schoolId, id));
    await db.delete(enrollments).where(eq(enrollments.schoolId, id));
    await db.delete(students).where(eq(students.schoolId, id));
    await db.delete(users).where(eq(users.schoolId, id));
    await db.delete(academicYears).where(eq(academicYears.schoolId, id));
  }
  await db.delete(schools).where(inArray(schools.id, schoolIds));
});

describe("a complete roll", () => {
  it("validates clean", async () => {
    const rows = await rowsForExport(ctx);
    expect(rows).toHaveLength(5);
    const summary = summarise(validateForExport(rows, template));
    expect(summary.errorCount, JSON.stringify(summary.groups.map((g) => g.field))).toBe(0);
    expect(summary.blocked).toBe(false);
  });

  it("writes a workbook that reads back with matching headers", async () => {
    const rows = await rowsForExport(ctx);
    const buf = await writeWorkbook(rows, template);
    const back = await readWorkbook(buf);

    expect(back.sheet).toBe(template.sheet);
    // Byte-for-byte header match: the portal matches on the header string.
    expect(back.headers).toEqual(template.columns.map((c) => c.header));
    expect(back.rows).toHaveLength(5);
  });

  it("keeps dates as text in DD/MM/YYYY, not coerced to a date type", async () => {
    const rows = await rowsForExport(ctx);
    const back = await readWorkbook(await writeWorkbook(rows, template));
    const i = back.headers.indexOf("Date of Birth");
    expect(back.rows[0][i]).toBe("01/01/2010");
  });

  it("keeps the admission number as text so leading zeros survive", async () => {
    const rows = await rowsForExport(ctx);
    const back = await readWorkbook(await writeWorkbook(rows, template));
    const i = back.headers.indexOf("Admission Number");
    expect(typeof back.rows[0][i]).toBe("string");
  });

  it("uppercases names and maps codes as declared", async () => {
    const rows = await rowsForExport(ctx);
    const back = await readWorkbook(await writeWorkbook(rows, template));
    const at = (h: string) => back.rows[0][back.headers.indexOf(h)];
    expect(at("Student Name")).toBe("ADITYA PATIL");
    expect(at("Social Category")).toBe("1");
    expect(at("Gender")).toBe("1");
  });

  it("writes no literal null or undefined anywhere", async () => {
    const rows = await rowsForExport(ctx);
    const back = await readWorkbook(await writeWorkbook(rows, template));
    const flat = back.rows.flat().join("|");
    expect(flat).not.toMatch(/\bnull\b/i);
    expect(flat).not.toMatch(/\bundefined\b/i);
  });
});

describe("an incomplete roll", () => {
  it("blocks and names the student", async () => {
    const s = await studentRepo.create(ctx, { ...complete(99), apaarId: undefined } as never);
    await studentRepo.upsertEnrollment(ctx, s.id, { class: "10", division: "अ", rollNo: 99 });

    const rows = await rowsForExport(ctx);
    const summary = summarise(validateForExport(rows, template));

    expect(summary.blocked).toBe(true);
    const group = summary.groups.find((g) => g.code === "apaar_missing");
    expect(group?.count).toBe(1);
    expect(group?.rows[0].grNumber).toBe(s.grNumber);

    // Clean up so later assertions are not affected.
    await db.delete(enrollments).where(eq(enrollments.studentId, s.id));
    await db.delete(auditLog).where(eq(auditLog.entityId, s.id));
    await db.delete(students).where(eq(students.id, s.id));
  });
});

describe("tenant isolation", () => {
  it("exports only this school's students", async () => {
    const rows = await rowsForExport(ctx);
    expect(rows.every((r) => r.school.udiseCode === "27251000999")).toBe(true);
    // The seeded pilot school has 25 students; none of them appear here.
    expect(rows).toHaveLength(5);
  });
});
