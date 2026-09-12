import "server-only";

import { sql } from "drizzle-orm";

import type { Ctx } from "@/lib/tenant";
import type { DocType } from "./repo";

/** Anything that can run SQL — the real db, or a transaction handle. */
export type Executor = { execute: (query: unknown) => Promise<unknown> };

/**
 * Allocates the next serial for a document type, under a row lock.
 *
 * MUST run inside the same transaction as the document insert. Allocating in
 * one transaction and inserting in another opens a window where a crash
 * consumes a number without producing a certificate, and a gap in a statutory
 * register is something a school has to explain to an inspector.
 *
 * `UPDATE ... RETURNING` takes the row lock implicitly and is atomic, so two
 * concurrent callers serialise here rather than both reading the same value.
 */
export async function allocateSerial(
  tx: Executor,
  ctx: Ctx,
  docType: DocType,
): Promise<number> {
  const result = await tx.execute(sql`
    INSERT INTO document_counters (school_id, doc_type, next_serial)
    VALUES (${ctx.schoolId}, ${docType}::doc_type, 2)
    ON CONFLICT (school_id, doc_type)
    DO UPDATE SET next_serial = document_counters.next_serial + 1
    RETURNING next_serial - 1 AS allocated
  `);

  const rows = result as unknown as Array<{ allocated: number | string }>;
  const allocated = Number(rows[0]?.allocated);

  if (!Number.isFinite(allocated) || allocated < 1) {
    throw new Error(
      `Serial allocation failed for ${docType}. Refusing to issue a document without a valid serial.`,
    );
  }
  return allocated;
}
