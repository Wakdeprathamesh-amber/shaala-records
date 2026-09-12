import "server-only";

import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { auditLog, enrollments, students } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";

import type { StudentFilter, StudentInput } from "./schema";

export const PAGE_SIZE = 25;

/** Empty strings from HTML forms become NULL, so a cleared optional field
 *  reads as absent rather than as the empty string — which matters because
 *  the export pre-flight tests for NULL. */
function blankToNull<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, v === "" ? null : v]),
  ) as T;
}

export type StudentListRow = {
  id: string;
  grNumber: string;
  nameMr: string;
  nameEn: string;
  class: string | null;
  division: string | null;
  rollNo: number | null;
  status: "studying" | "left" | "tc_issued";
};

export async function list(
  ctx: Ctx,
  filter: StudentFilter,
): Promise<{ rows: StudentListRow[]; total: number; page: number; pageSize: number }> {
  const conditions = [scoped(students, ctx)];

  if (filter.search) {
    const q = `%${filter.search}%`;
    // Searches both scripts and the GR number in one box, because the clerk
    // does not think of them as different fields — they think "find Aditya".
    conditions.push(
      or(
        ilike(students.firstNameMr, q),
        ilike(students.middleNameMr, q),
        ilike(students.lastNameMr, q),
        ilike(students.firstNameEn, q),
        ilike(students.middleNameEn, q),
        ilike(students.lastNameEn, q),
        ilike(students.grNumber, q),
      )!,
    );
  }
  if (filter.status) conditions.push(eq(students.status, filter.status));
  if (filter.class) conditions.push(eq(enrollments.class, filter.class));
  if (filter.division) conditions.push(eq(enrollments.division, filter.division));

  const where = and(...conditions);

  const rows = await db
    .select({
      id: students.id,
      grNumber: students.grNumber,
      firstNameMr: students.firstNameMr,
      middleNameMr: students.middleNameMr,
      lastNameMr: students.lastNameMr,
      firstNameEn: students.firstNameEn,
      lastNameEn: students.lastNameEn,
      class: enrollments.class,
      division: enrollments.division,
      rollNo: enrollments.rollNo,
      status: students.status,
    })
    .from(students)
    .leftJoin(
      enrollments,
      and(
        eq(enrollments.studentId, students.id),
        eq(enrollments.academicYearId, ctx.academicYearId),
      ),
    )
    .where(where)
    // Numeric ordering: GR "10" must not sort before GR "9".
    .orderBy(asc(sql`NULLIF(regexp_replace(${students.grNumber}, '\\D', '', 'g'), '')::bigint`))
    .limit(PAGE_SIZE)
    .offset((filter.page - 1) * PAGE_SIZE);

  const [totalRow] = await db
    .select({ n: count() })
    .from(students)
    .leftJoin(
      enrollments,
      and(
        eq(enrollments.studentId, students.id),
        eq(enrollments.academicYearId, ctx.academicYearId),
      ),
    )
    .where(where);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      grNumber: r.grNumber,
      nameMr: [r.firstNameMr, r.middleNameMr, r.lastNameMr].filter(Boolean).join(" "),
      nameEn: [r.firstNameEn, r.lastNameEn].filter(Boolean).join(" "),
      class: r.class,
      division: r.division,
      rollNo: r.rollNo,
      status: r.status,
    })),
    total: totalRow?.n ?? 0,
    page: filter.page,
    pageSize: PAGE_SIZE,
  };
}

/** Returns null for a student belonging to another school — never throws, so
 *  a cross-tenant id is indistinguishable from a non-existent one. */
export async function byId(ctx: Ctx, id: string) {
  const [row] = await db
    .select()
    .from(students)
    .where(scoped(students, ctx, eq(students.id, id)))
    .limit(1);
  return row ?? null;
}

export async function byGr(ctx: Ctx, grNumber: string) {
  const [row] = await db
    .select()
    .from(students)
    .where(scoped(students, ctx, eq(students.grNumber, grNumber)))
    .limit(1);
  return row ?? null;
}

export async function enrollmentHistory(ctx: Ctx, studentId: string) {
  return db
    .select({
      id: enrollments.id,
      academicYearId: enrollments.academicYearId,
      class: enrollments.class,
      division: enrollments.division,
      rollNo: enrollments.rollNo,
    })
    .from(enrollments)
    .where(scoped(enrollments, ctx, eq(enrollments.studentId, studentId)))
    .orderBy(desc(enrollments.academicYearId));
}

/**
 * The next free General Register number for this school.
 *
 * GR numbers are stored as text because some schools prefix them, but they are
 * allocated numerically. Must run inside the same transaction as the insert —
 * otherwise two clerks adding a student at the same moment both read the same
 * maximum and the unique constraint rejects the second one.
 */
export async function nextGrNumber(
  tx: Pick<typeof db, "execute">,
  ctx: Ctx,
): Promise<string> {
  // Serialise allocation per school with a transaction-scoped advisory lock.
  //
  // The obvious `SELECT MAX(...) FOR UPDATE` is rejected by Postgres —
  // row locks cannot be combined with an aggregate, since there is no single
  // row to lock. Locking the schools row would work but would also block
  // unrelated profile edits. An advisory lock costs nothing, is released
  // automatically when the transaction ends or aborts, and contends only with
  // another GR allocation for the same school.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext('shaala:gr'), hashtext(${ctx.schoolId}))`,
  );

  const result = await tx.execute(sql`
    SELECT COALESCE(
      MAX(NULLIF(regexp_replace(gr_number, '\\D', '', 'g'), '')::bigint), 0
    ) + 1 AS next
    FROM students
    WHERE school_id = ${ctx.schoolId}
  `);
  const row = (result as unknown as Array<{ next: string | number }>)[0];
  return String(row?.next ?? 1);
}

export async function create(ctx: Ctx, input: StudentInput & { grNumber?: string }) {
  return db.transaction(async (tx) => {
    const grNumber = input.grNumber?.trim() || (await nextGrNumber(tx as never, ctx));

    const values = blankToNull({
      ...input,
      grNumber,
      schoolId: ctx.schoolId,
    }) as never;

    const [row] = await tx.insert(students).values(values).returning();

    await tx.insert(auditLog).values({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      entity: "student",
      entityId: row.id,
      action: "create",
      after: row as never,
    });

    return row;
  });
}

export async function update(ctx: Ctx, id: string, patch: Partial<StudentInput>) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(students)
      .where(scoped(students, ctx, eq(students.id, id)))
      .limit(1);

    if (!before) return null;

    const [row] = await tx
      .update(students)
      .set({ ...blankToNull(patch), updatedAt: new Date() } as never)
      .where(scoped(students, ctx, eq(students.id, id)))
      .returning();

    await tx.insert(auditLog).values({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      entity: "student",
      entityId: id,
      action: "update",
      before: before as never,
      after: row as never,
    });

    return row;
  });
}

/**
 * Changes a student's status. There is no delete path anywhere in this module
 * — a student who has left is a permanent part of the register, and their
 * leaving certificate must remain verifiable years later.
 */
export async function setStatus(
  ctx: Ctx,
  id: string,
  status: "studying" | "left" | "tc_issued",
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({ status: students.status })
      .from(students)
      .where(scoped(students, ctx, eq(students.id, id)))
      .limit(1);

    if (!before) return null;

    const [row] = await tx
      .update(students)
      .set({ status, updatedAt: new Date() })
      .where(scoped(students, ctx, eq(students.id, id)))
      .returning();

    await tx.insert(auditLog).values({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      entity: "student",
      entityId: id,
      action: `status:${before.status}->${status}`,
      before: before as never,
      after: { status } as never,
    });

    return row;
  });
}

export async function upsertEnrollment(
  ctx: Ctx,
  studentId: string,
  data: { class: string; division?: string | null; rollNo?: number | null },
) {
  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      scoped(
        enrollments,
        ctx,
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.academicYearId, ctx.academicYearId),
        )!,
      ),
    )
    .limit(1);

  if (existing) {
    await db.update(enrollments).set(data).where(eq(enrollments.id, existing.id));
    return existing.id;
  }

  const [row] = await db
    .insert(enrollments)
    .values({
      schoolId: ctx.schoolId,
      studentId,
      academicYearId: ctx.academicYearId,
      ...data,
    })
    .returning({ id: enrollments.id });
  return row.id;
}
