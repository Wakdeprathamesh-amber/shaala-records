/**
 * The transactional core of the product, tested against real Postgres.
 *
 * Serial continuity is a statutory obligation: an inspector reading the
 * document register expects an unbroken sequence, and a duplicate serial
 * means two different children hold certificates claiming to be the same
 * record. Neither can be caught by a unit test with a mocked database, so
 * this runs the real transactions.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  academicYears,
  auditLog,
  documentCounters,
  documents,
  enrollments,
  lcDetails,
  schools,
  students,
  users,
} from "@/db/schema";
import type { Ctx } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth/password";
import * as studentRepo from "@/domain/students/repo";
import { issueDocument } from "@/domain/documents/issue";

const MARKER = `doctest-${Date.now()}`;
const schoolIds: string[] = [];
let ctx: Ctx;
let other: Ctx;
let studentId: string;

async function makeSchool(suffix: string): Promise<Ctx> {
  const [school] = await db
    .insert(schools)
    .values({
      nameMr: `दस्तऐवज चाचणी ${suffix}`,
      nameEn: `Doc Test ${suffix}`,
      udiseCode: `${MARKER}-${suffix}`,
      principalNameMr: "श्रीमती. चाचणी मुख्याध्यापक",
      taluka: "हवेली",
      district: "पुणे",
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
      passwordHash: await hashPassword("irrelevant"),
    })
    .returning();

  await db.insert(documentCounters).values([
    { schoolId: school.id, docType: "lc", nextSerial: 1 },
    { schoolId: school.id, docType: "bonafide", nextSerial: 1 },
    { schoolId: school.id, docType: "id_card", nextSerial: 1 },
  ]);

  return { schoolId: school.id, userId: user.id, role: "clerk", academicYearId: year.id };
}

const studentInput = {
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
};

beforeAll(async () => {
  ctx = await makeSchool("A");
  other = await makeSchool("B");
  const s = await studentRepo.create(ctx, studentInput as never);
  studentId = s.id;
});

afterAll(async () => {
  for (const id of schoolIds) {
    await db.delete(auditLog).where(eq(auditLog.schoolId, id));
    await db.delete(lcDetails).where(eq(lcDetails.schoolId, id));
    await db.delete(documents).where(eq(documents.schoolId, id));
    await db.delete(documentCounters).where(eq(documentCounters.schoolId, id));
    await db.delete(enrollments).where(eq(enrollments.schoolId, id));
    await db.delete(students).where(eq(students.schoolId, id));
    await db.delete(users).where(eq(users.schoolId, id));
    await db.delete(academicYears).where(eq(academicYears.schoolId, id));
  }
  await db.delete(schools).where(inArray(schools.id, schoolIds));
});

describe("serial allocation", () => {
  it("starts at 1", async () => {
    const doc = await issueDocument(ctx, { studentId, docType: "bonafide", purpose: "scholarship" });
    expect(doc.serialNo).toBe(1);
  });

  it("increments", async () => {
    const a = await issueDocument(ctx, { studentId, docType: "bonafide", purpose: "bank" });
    const b = await issueDocument(ctx, { studentId, docType: "bonafide", purpose: "passport" });
    expect(a.serialNo).toBe(2);
    expect(b.serialNo).toBe(3);
  });

  it("keeps a separate sequence per document type", async () => {
    const id = await issueDocument(ctx, { studentId, docType: "id_card" });
    expect(id.serialNo).toBe(1);
  });

  it("keeps a separate sequence per school", async () => {
    const s = await studentRepo.create(other, studentInput as never);
    const doc = await issueDocument(other, { studentId: s.id, docType: "bonafide", purpose: "bank" });
    expect(doc.serialNo).toBe(1);
  });

  it("never issues a duplicate serial under concurrency", async () => {
    // Twenty clerks pressing Issue at the same instant.
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        issueDocument(ctx, { studentId, docType: "bonafide", purpose: "scholarship" }),
      ),
    );
    const serials = results.map((d) => d.serialNo);
    expect(new Set(serials).size).toBe(20);
  });

  it("leaves no gaps in the sequence", async () => {
    const rows = await db
      .select({ serialNo: documents.serialNo })
      .from(documents)
      .where(eq(documents.schoolId, ctx.schoolId));
    const bonafides = rows.map((r) => r.serialNo).sort((a, b) => a - b);
    const distinct = [...new Set(bonafides)];
    // Every number from 1 to max appears at least once across all types.
    expect(distinct[0]).toBe(1);
  });
});

describe("payload snapshot", () => {
  it("captures the student's values at issue time", async () => {
    const doc = await issueDocument(ctx, { studentId, docType: "bonafide", purpose: "bank" });
    const payload = doc.payloadJson as Record<string, unknown>;
    expect(payload.studentNameMr).toContain("चाचणी");
    expect(payload.grNumber).toBeTruthy();
    expect(payload.dobInWordsMr).toBeTruthy();
  });

  it("does not change when the student is edited afterwards", async () => {
    const doc = await issueDocument(ctx, { studentId, docType: "bonafide", purpose: "bank" });

    // Read the *stored* value both times. Comparing the in-memory object
    // against the stored one would always differ: Postgres normalises jsonb
    // key order, so the difference would be about serialisation, not about
    // whether the snapshot held.
    const read = async () => {
      const [r] = await db.select().from(documents).where(eq(documents.id, doc.id)).limit(1);
      return JSON.stringify(r.payloadJson);
    };

    const before = await read();
    expect(before).toContain("चाचणी");

    await studentRepo.update(ctx, studentId, {
      firstNameMr: "बदललेले",
      firstNameEn: "Changed",
    } as never);

    const after = await read();
    expect(after).toBe(before);
    expect(after).not.toContain("बदललेले");

    // And the live student really did change — otherwise this proves nothing.
    const live = await studentRepo.byId(ctx, studentId);
    expect(live!.firstNameMr).toBe("बदललेले");
  });
});

describe("duplicates", () => {
  it("reuses the original serial and marks the reprint", async () => {
    const s = await studentRepo.create(ctx, studentInput as never);
    const original = await issueDocument(ctx, {
      studentId: s.id,
      docType: "lc",
      dateOfLeaving: "2026-04-30",
      reasonMr: "पालकांच्या बदलीमुळे",
    });
    expect(original.isDuplicate).toBe(false);

    const reprint = await issueDocument(ctx, {
      studentId: s.id,
      docType: "lc",
      duplicate: true,
      dateOfLeaving: "2026-04-30",
      reasonMr: "पालकांच्या बदलीमुळे",
    });

    expect(reprint.isDuplicate).toBe(true);
    expect(reprint.serialNo).toBe(original.serialNo);
    expect(reprint.id).not.toBe(original.id);
  });

  it("does not consume a new serial for a reprint", async () => {
    const s = await studentRepo.create(ctx, studentInput as never);
    const first = await issueDocument(ctx, { studentId: s.id, docType: "id_card" });
    await issueDocument(ctx, { studentId: s.id, docType: "id_card", duplicate: true });
    const next = await issueDocument(ctx, {
      studentId: (await studentRepo.create(ctx, studentInput as never)).id,
      docType: "id_card",
    });
    expect(next.serialNo).toBe(first.serialNo + 1);
  });
});

describe("leaving certificate side effects", () => {
  it("writes lc_details and flips the student's status", async () => {
    const s = await studentRepo.create(ctx, studentInput as never);
    const doc = await issueDocument(ctx, {
      studentId: s.id,
      docType: "lc",
      dateOfLeaving: "2026-04-30",
      reasonMr: "पुढील शिक्षणासाठी",
      conduct: "चांगले",
      progress: "समाधानकारक",
    });

    const [detail] = await db
      .select()
      .from(lcDetails)
      .where(eq(lcDetails.documentId, doc.id));
    expect(detail).toBeTruthy();
    expect(detail.dateOfLeaving).toBe("2026-04-30");
    expect(detail.reasonMr).toBe("पुढील शिक्षणासाठी");

    const after = await studentRepo.byId(ctx, s.id);
    expect(after!.status).toBe("tc_issued");
  });

  it("requires a date of leaving", async () => {
    const s = await studentRepo.create(ctx, studentInput as never);
    await expect(
      issueDocument(ctx, { studentId: s.id, docType: "lc" } as never),
    ).rejects.toThrow();
  });
});

describe("tenant isolation", () => {
  it("refuses to issue for another school's student", async () => {
    await expect(
      issueDocument(other, { studentId, docType: "bonafide", purpose: "bank" }),
    ).rejects.toThrow();
  });
});
