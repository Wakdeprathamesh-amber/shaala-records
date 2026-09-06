import "server-only";

import { and, eq, or } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";

/**
 * Looks up a user for login by phone or email.
 *
 * Deliberately NOT tenant-scoped: at login there is no session yet, so there
 * is no Ctx to scope by. This is the one legitimate unscoped user query in the
 * codebase, which is why it is a named function here rather than an inline
 * query somewhere — the school is established *from* the row it returns.
 */
export async function findByIdentifierForLogin(identifier: string) {
  const value = identifier.trim();
  const [row] = await db
    .select({
      id: users.id,
      schoolId: users.schoolId,
      role: users.role,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(or(eq(users.email, value), eq(users.phone, value)))
    .limit(1);
  return row ?? null;
}

export async function touchLastLogin(userId: string): Promise<void> {
  await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, userId));
}

/** Everything below is tenant-scoped in the normal way. */
export async function listForSchool(ctx: Ctx) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      lastLogin: users.lastLogin,
    })
    .from(users)
    .where(scoped(users, ctx));
}

export async function findInSchool(ctx: Ctx, userId: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(scoped(users, ctx, eq(users.id, userId)))
    .limit(1);
  return row ?? null;
}

export async function countPrincipals(ctx: Ctx): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(scoped(users, ctx), eq(users.role, "principal")));
  return rows.length;
}
