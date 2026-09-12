import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { auditLog, enrollments, importBatches, importRows, students } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";
import { StudentCreateSchema } from "@/domain/students/schema";

import { normaliseValues, type StagedRow } from "./parse";
import { existingByGrNumber } from "./repo";

export type RowValidation = {
  rowNumber: number;
  values: Record<string, string>;
  errors: Record<string, string>;
  /** An existing student with this GR number — the row will update, not insert. */
  existingStudentId: string | null;
};

/** Validates staged rows without writing anything. */
export async function validateStaged(
  ctx: Ctx,
  rows: StagedRow[],
): Promise<RowValidation[]> {
  const grNumbers = rows.map((r) => r.values.grNumber).filter(Boolean);

  const byGr = await existingByGrNumber(ctx, grNumbers);

  // A GR number repeated inside the file itself is an error in the file, not
  // a match against the register.
  const seenInFile = new Map<string, number>();

  return rows.map((row) => {
    const values = normaliseValues(row.values);
    const errors: Record<string, string> = {};

    const gr = values.grNumber?.trim();
    if (gr) {
      const first = seenInFile.get(gr);
      if (first !== undefined) {
        errors.grNumber = `GR ${gr} also appears on row ${first} of this file.`;
      } else {
        seenInFile.set(gr, row.rowNumber);
      }
    }

    const parsed = StudentCreateSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_");
        if (!errors[key]) errors[key] = issue.message;
      }
    }

    return {
      rowNumber: row.rowNumber,
      values,
      errors,
      existingStudentId: gr ? (byGr.get(gr) ?? null) : null,
    };
  });
}

export type CommitResult = {
  inserted: number;
  updated: number;
  skipped: number;
  failures: Array<{ rowNumber: number; reason: string }>;
};

/**
 * Commits validated rows.
 *
 * Two properties matter more than throughput:
 *
 * 1. **Transactional.** Either the whole batch lands or none of it does. A
 *    half-imported register is worse than an empty one, because nobody knows
 *    which half.
 * 2. **Idempotent by GR number.** Clerks re-run imports — the first attempt
 *    timed out, or they are not sure it worked. A row whose GR number already
 *    exists updates that student instead of creating a second record, so
 *    re-running commits nothing new rather than duplicating the school.
 *
 * Rows with errors are skipped, not fatal: 197 good rows out of 200 should
 * import, with the 3 reported for correction.
 */
export async function commitBatch(
  ctx: Ctx,
  batchId: string,
  validated: RowValidation[],
): Promise<CommitResult> {
  const good = validated.filter((r) => Object.keys(r.errors).length === 0);
  const skipped = validated.length - good.length;

  const result: CommitResult = {
    inserted: 0,
    updated: 0,
    skipped,
    failures: validated
      .filter((r) => Object.keys(r.errors).length > 0)
      .map((r) => ({
        rowNumber: r.rowNumber,
        reason: Object.entries(r.errors)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; "),
      })),
  };

  if (good.length === 0) {
    await db
      .update(importBatches)
      .set({ status: "failed" })
      .where(scoped(importBatches, ctx, eq(importBatches.id, batchId)));
    return result;
  }

  await db.transaction(async (tx) => {
    for (const row of good) {
      const { class: cls, division, rollNo, ...studentValues } = row.values;

      const payload = Object.fromEntries(
        Object.entries(studentValues).map(([k, v]) => [k, v === "" ? null : v]),
      );

      if (row.existingStudentId) {
        await tx
          .update(students)
          .set({ ...payload, updatedAt: new Date() } as never)
          .where(scoped(students, ctx, eq(students.id, row.existingStudentId)));
        result.updated += 1;
      } else {
        const [created] = await tx
          .insert(students)
          .values({ ...payload, schoolId: ctx.schoolId } as never)
          .returning({ id: students.id });
        row.existingStudentId = created.id;
        result.inserted += 1;
      }

      if (cls) {
        const studentId = row.existingStudentId!;
        const [already] = await tx
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(
            and(
              scoped(enrollments, ctx),
              eq(enrollments.studentId, studentId),
              eq(enrollments.academicYearId, ctx.academicYearId),
            )!,
          )
          .limit(1);

        const values = {
          class: cls,
          division: division || null,
          rollNo: Number(rollNo) || null,
        };

        if (already) {
          await tx.update(enrollments).set(values).where(eq(enrollments.id, already.id));
        } else {
          await tx.insert(enrollments).values({
            schoolId: ctx.schoolId,
            studentId,
            academicYearId: ctx.academicYearId,
            ...values,
          });
        }
      }

      await tx
        .update(importRows)
        .set({ studentId: row.existingStudentId })
        .where(
          and(
            scoped(importRows, ctx),
            eq(importRows.batchId, batchId),
            eq(importRows.rowNumber, row.rowNumber),
          )!,
        );
    }

    await tx
      .update(importBatches)
      .set({ status: "committed" })
      .where(scoped(importBatches, ctx, eq(importBatches.id, batchId)));

    await tx.insert(auditLog).values({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      entity: "import_batch",
      entityId: batchId,
      action: "commit",
      after: {
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
      } as never,
    });
  });

  return result;
}
