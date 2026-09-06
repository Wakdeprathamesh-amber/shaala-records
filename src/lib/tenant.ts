/**
 * Tenant scoping. The single most important piece of infrastructure here.
 *
 * A missing `WHERE school_id = ?` does not throw and does not look wrong in
 * review — it quietly puts one school's children on another school's leaving
 * certificates. So no repository builds a where clause by hand: they all start
 * from scoped(), which cannot be constructed without a Ctx.
 *
 * The companion guardrail is tests/unit/no-unscoped-queries.test.ts, which
 * fails the build if a raw db.select() appears outside the repository layer.
 */
import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export type Role = "principal" | "clerk";

export type Ctx = {
  schoolId: string;
  userId: string;
  role: Role;
  academicYearId: string;
};

/** A table that can be tenant-scoped. Passing a table without `schoolId` to
 *  scoped() is a compile error rather than a runtime surprise. */
type ScopableTable = { schoolId: PgColumn };

/**
 * Returns the WHERE condition for a tenant-scoped query, optionally ANDed with
 * the caller's own condition. The school predicate is always first — both so
 * the index is used and so it is visible at a glance in a logged query.
 */
export function scoped<T extends ScopableTable>(
  table: T,
  ctx: Ctx,
  extra?: SQL,
): SQL {
  const base = eq(table.schoolId, ctx.schoolId);
  return extra ? and(base, extra)! : base;
}

/** Principal can do everything a clerk can. Clerk cannot do principal work. */
const RANK: Record<Role, number> = { clerk: 1, principal: 2 };

export function hasRole(ctx: Ctx, minRole: Role): boolean {
  return RANK[ctx.role] >= RANK[minRole];
}

/** Thrown when there is no session, or the session's role is insufficient.
 *  Callers turn this into a redirect or a 403 — it must never reach the user
 *  as a stack trace. */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly kind: "unauthenticated" | "forbidden",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}
