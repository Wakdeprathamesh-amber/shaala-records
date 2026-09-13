import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

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

  /**
   * Batched, not row-by-row.
   *
   * The first version did four round trips per student. Against a managed
   * Postgres in Mumbai that is ~60ms each, so a 200-row file took three
   * minutes and an 800-student register would have taken twelve. A clerk
   * watching a spinner for twelve minutes assumes it has hung and refreshes,
   * which is exactly the double-import the idempotency exists to survive —
   * better not to invite it. Inserts, the enrolment lookup and the staging
   * link are now one statement each; only updates stay per-row, since each
   * carries different values, and those only occur on a re-import.
   */
  await db.transaction(async (tx) => {
    const studentPayload = (row: RowValidation) => {
      const { class: _c, division: _d, rollNo: _r, ...sv } = row.values;
      return Object.fromEntries(
        Object.entries(sv).map(([k, v]) => [k, v === "" ? null : v]),
      );
    };

    const toInsert = good.filter((r) => !r.existingStudentId);
    const toUpdate = good.filter((r) => r.existingStudentId);

    // 1. New students: one INSERT for all of them.
    if (toInsert.length) {
      const created = await tx
        .insert(students)
        .values(toInsert.map((r) => ({ ...studentPayload(r), schoolId: ctx.schoolId })) as never)
        .returning({ id: students.id, grNumber: students.grNumber });
      const byGr = new Map(created.map((c) => [c.grNumber, c.id]));
      for (const r of toInsert) r.existingStudentId = byGr.get(r.values.grNumber) ?? null;
      result.inserted = created.length;
    }

    // 2. Existing students: per-row, because every row's values differ.
    for (const r of toUpdate) {
      await tx
        .update(students)
        .set({ ...studentPayload(r), updatedAt: new Date() } as never)
        .where(scoped(students, ctx, eq(students.id, r.existingStudentId!)));
    }
    result.updated = toUpdate.length;

    // 3. Enrolments: one lookup, one bulk insert, per-row update of the rest.
    const withClass = good.filter((r) => r.values.class && r.existingStudentId);
    if (withClass.length) {
      const ids = withClass.map((r) => r.existingStudentId!);
      const existing = await tx
        .select({ id: enrollments.id, studentId: enrollments.studentId })
        .from(enrollments)
        .where(
          and(
            scoped(enrollments, ctx),
            eq(enrollments.academicYearId, ctx.academicYearId),
            inArray(enrollments.studentId, ids),
          )!,
        );
      const existingBy = new Map(existing.map((e) => [e.studentId, e.id]));
      const enrolValues = (r: RowValidation) => ({
        class: r.values.class,
        division: r.values.division || null,
        rollNo: Number(r.values.rollNo) || null,
      });

      const fresh = withClass.filter((r) => !existingBy.has(r.existingStudentId!));
      if (fresh.length) {
        await tx.insert(enrollments).values(
          fresh.map((r) => ({
            schoolId: ctx.schoolId,
            studentId: r.existingStudentId!,
            academicYearId: ctx.academicYearId,
            ...enrolValues(r),
          })),
        );
      }
      for (const r of withClass) {
        const id = existingBy.get(r.existingStudentId!);
        if (id) await tx.update(enrollments).set(enrolValues(r)).where(eq(enrollments.id, id));
      }
    }

    // 4. Link every staged row to its student in a single UPDATE ... FROM unnest.
    const linked = good.filter((r) => r.existingStudentId);
    if (linked.length) {
      // Drizzle expands a bare JS array in a template as a row constructor
      // `($1, $2, …)` — a record, not a Postgres array — so `::int[]` fails
      // with "cannot cast type record to integer[]". sql.join inside ARRAY[]
      // produces a real array and keeps every value a bound parameter.
      const rn = sql.join(linked.map((r) => sql`${r.rowNumber}::int`), sql`, `);
      const sid = sql.join(linked.map((r) => sql`${r.existingStudentId!}::uuid`), sql`, `);
      await tx.execute(sql`
        UPDATE import_rows AS ir
        SET student_id = v.sid
        FROM unnest(ARRAY[${rn}], ARRAY[${sid}]) AS v(rn, sid)
        WHERE ir.batch_id = ${batchId}
          AND ir.school_id = ${ctx.schoolId}
          AND ir.row_number = v.rn
      `);
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
