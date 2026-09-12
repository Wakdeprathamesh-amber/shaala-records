import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { academicYears, enrollments, exportRuns, schools, students } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";

import type { ExportRow } from "./mapper";
import type { ValidatableRow } from "./validate";

/**
 * Every currently-studying student, shaped for both the mapper and the
 * validator. One query feeds both, so the file and the pre-flight report can
 * never disagree about what is being exported.
 */
export async function rowsForExport(
  ctx: Ctx,
): Promise<Array<ExportRow & ValidatableRow>> {
  const rows = await db
    .select({
      student: students,
      enrollment: enrollments,
      school: schools,
    })
    .from(students)
    .innerJoin(schools, eq(schools.id, students.schoolId))
    .leftJoin(
      enrollments,
      and(
        eq(enrollments.studentId, students.id),
        eq(enrollments.academicYearId, ctx.academicYearId),
      ),
    )
    .where(and(scoped(students, ctx), eq(students.status, "studying"))!);

  return rows.map(({ student: s, enrollment, school }) => ({
    studentId: s.id,
    grNumber: s.grNumber,
    student: {
      ...s,
      nameEn: [s.firstNameEn, s.middleNameEn, s.lastNameEn].filter(Boolean).join(" "),
      nameMr: [s.firstNameMr, s.middleNameMr, s.lastNameMr].filter(Boolean).join(" "),
    },
    enrollment: {
      class: enrollment?.class ?? null,
      division: enrollment?.division ?? null,
      rollNo: enrollment?.rollNo ?? null,
    },
    school: { udiseCode: school.udiseCode },
  }));
}

export async function recordRun(
  ctx: Ctx,
  input: {
    target: "udise" | "saral";
    templateVersion: string;
    validationSummaryJson: unknown;
    filePath?: string | null;
  },
) {
  const [row] = await db
    .insert(exportRuns)
    .values({
      schoolId: ctx.schoolId,
      academicYearId: ctx.academicYearId,
      target: input.target,
      templateVersion: input.templateVersion,
      validationSummaryJson: input.validationSummaryJson as never,
      filePath: input.filePath ?? null,
    })
    .returning();
  return row;
}

export async function recentRuns(ctx: Ctx, limit = 10) {
  return db
    .select()
    .from(exportRuns)
    .where(scoped(exportRuns, ctx))
    .orderBy(desc(exportRuns.generatedAt))
    .limit(limit);
}

export async function runById(ctx: Ctx, id: string) {
  const [row] = await db
    .select()
    .from(exportRuns)
    .where(scoped(exportRuns, ctx, eq(exportRuns.id, id)))
    .limit(1);
  return row ?? null;
}

export async function currentYearLabel(ctx: Ctx): Promise<string | null> {
  const [row] = await db
    .select({ label: academicYears.label })
    .from(academicYears)
    .where(scoped(academicYears, ctx, eq(academicYears.id, ctx.academicYearId)))
    .limit(1);
  return row?.label ?? null;
}
