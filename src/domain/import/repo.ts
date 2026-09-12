import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { importBatches, importRows, students } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";

import type { StagedRow } from "./parse";

export async function recentBatches(ctx: Ctx, limit = 10) {
  return db
    .select()
    .from(importBatches)
    .where(scoped(importBatches, ctx))
    .orderBy(desc(importBatches.uploadedAt))
    .limit(limit);
}

export async function createBatch(
  ctx: Ctx,
  filename: string,
  rows: StagedRow[],
  mapping: unknown,
) {
  const [batch] = await db
    .insert(importBatches)
    .values({
      schoolId: ctx.schoolId,
      filename,
      uploadedByUserId: ctx.userId,
      mappingJson: mapping as never,
    })
    .returning();

  if (rows.length) {
    await db.insert(importRows).values(
      rows.map((r) => ({
        schoolId: ctx.schoolId,
        batchId: batch.id,
        rowNumber: r.rowNumber,
        rawJson: r.values as never,
      })),
    );
  }

  return batch;
}

export async function batchById(ctx: Ctx, id: string) {
  const [row] = await db
    .select()
    .from(importBatches)
    .where(scoped(importBatches, ctx, eq(importBatches.id, id)))
    .limit(1);
  return row ?? null;
}

export async function stagedRowsFor(ctx: Ctx, batchId: string): Promise<StagedRow[]> {
  const rows = await db
    .select({ rowNumber: importRows.rowNumber, rawJson: importRows.rawJson })
    .from(importRows)
    .where(scoped(importRows, ctx, eq(importRows.batchId, batchId)))
    .orderBy(importRows.rowNumber);

  return rows.map((r) => ({
    rowNumber: r.rowNumber,
    values: r.rawJson as Record<string, string>,
  }));
}

/** GR number to student id, for rows that already exist in the register. */
export async function existingByGrNumber(
  ctx: Ctx,
  grNumbers: string[],
): Promise<Map<string, string>> {
  if (grNumbers.length === 0) return new Map();
  const rows = await db
    .select({ id: students.id, grNumber: students.grNumber })
    .from(students)
    .where(and(scoped(students, ctx), inArray(students.grNumber, grNumbers))!);
  return new Map(rows.map((r) => [r.grNumber, r.id]));
}
