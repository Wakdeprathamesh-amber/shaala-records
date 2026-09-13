import "server-only";

import { and, count, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { enrollments, students } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";

import type { Cell } from "./pivot";

/** Studying students in the current year, counted by class × category × gender. */
export async function demographicCells(ctx: Ctx): Promise<Cell[]> {
  const rows = await db
    .select({
      class: enrollments.class,
      category: students.category,
      gender: students.gender,
      n: count(),
    })
    .from(students)
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.studentId, students.id),
        eq(enrollments.academicYearId, ctx.academicYearId),
      ),
    )
    .where(and(scoped(students, ctx), eq(students.status, "studying"))!)
    .groupBy(enrollments.class, students.category, students.gender);

  return rows.map((r) => ({ class: r.class, category: r.category, gender: r.gender, n: Number(r.n) }));
}
