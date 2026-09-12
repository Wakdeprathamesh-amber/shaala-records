import "server-only";

import { and, count, eq, gte, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, students } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";
import { daysUntilSeptember30 } from "@/lib/deadline";

export type DashboardSummary = {
  studentCount: number;
  documentsThisMonth: number;
  exportBlocked: number;
  daysToDeadline: number;
};

export async function getDashboardSummary(ctx: Ctx): Promise<DashboardSummary> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [studentRow] = await db
    .select({ n: count() })
    .from(students)
    .where(and(scoped(students, ctx), eq(students.status, "studying")));

  const [docRow] = await db
    .select({ n: count() })
    .from(documents)
    .where(
      and(
        scoped(documents, ctx),
        gte(documents.issuedOn, startOfMonth.toISOString().slice(0, 10)),
      ),
    );

  // A cheap approximation of the export pre-flight: the two failures that
  // account for nearly all portal rejections. Milestone 4's validator is the
  // authoritative check — this only needs to be right enough to be alarming.
  const [blockedRow] = await db
    .select({ n: count() })
    .from(students)
    .where(
      and(
        scoped(students, ctx),
        eq(students.status, "studying"),
        or(
          isNull(students.apaarId),
          sql`${students.firstNameEn} IS NULL OR btrim(${students.firstNameEn}) = ''`,
          sql`${students.lastNameEn} IS NULL OR btrim(${students.lastNameEn}) = ''`,
        ),
      ),
    );

  return {
    studentCount: studentRow?.n ?? 0,
    documentsThisMonth: docRow?.n ?? 0,
    exportBlocked: blockedRow?.n ?? 0,
    daysToDeadline: daysUntilSeptember30(),
  };
}
