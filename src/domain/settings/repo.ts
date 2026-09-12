import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { academicYears, auditLog, schools, users } from "@/db/schema";
import { scoped, type Ctx } from "@/lib/tenant";

export async function school(ctx: Ctx) {
  const [row] = await db.select().from(schools).where(eq(schools.id, ctx.schoolId)).limit(1);
  return row ?? null;
}

export async function updateSchool(ctx: Ctx, patch: Record<string, unknown>) {
  const [before] = await db.select().from(schools).where(eq(schools.id, ctx.schoolId)).limit(1);

  const [row] = await db
    .update(schools)
    .set(patch as never)
    .where(eq(schools.id, ctx.schoolId))
    .returning();

  await db.insert(auditLog).values({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
    entity: "school",
    entityId: ctx.schoolId,
    action: "update",
    before: before as never,
    after: row as never,
  });

  return row;
}

export async function listUsers(ctx: Ctx) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(scoped(users, ctx))
    .orderBy(users.createdAt);
}

export async function createUser(
  ctx: Ctx,
  input: { name: string; email?: string | null; phone?: string | null; role: "principal" | "clerk"; passwordHash: string },
) {
  const [row] = await db
    .insert(users)
    .values({
      schoolId: ctx.schoolId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      role: input.role,
      passwordHash: input.passwordHash,
    })
    .returning({ id: users.id, name: users.name, role: users.role });

  await db.insert(auditLog).values({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
    entity: "user",
    entityId: row.id,
    action: "create",
    after: { name: row.name, role: row.role } as never,
  });

  return row;
}

export async function setUserPassword(ctx: Ctx, userId: string, passwordHash: string) {
  const [row] = await db
    .update(users)
    .set({ passwordHash })
    .where(scoped(users, ctx, eq(users.id, userId)))
    .returning({ id: users.id });

  if (row) {
    await db.insert(auditLog).values({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      entity: "user",
      entityId: userId,
      action: "password_reset",
    });
  }
  return row ?? null;
}

export async function listYears(ctx: Ctx) {
  return db
    .select()
    .from(academicYears)
    .where(scoped(academicYears, ctx))
    .orderBy(desc(academicYears.startDate));
}

export async function createYear(
  ctx: Ctx,
  input: { label: string; startDate: string; endDate: string; makeCurrent: boolean },
) {
  return db.transaction(async (tx) => {
    if (input.makeCurrent) {
      await tx
        .update(academicYears)
        .set({ isCurrent: false })
        .where(eq(academicYears.schoolId, ctx.schoolId));
    }

    const [row] = await tx
      .insert(academicYears)
      .values({
        schoolId: ctx.schoolId,
        label: input.label,
        startDate: input.startDate,
        endDate: input.endDate,
        isCurrent: input.makeCurrent,
      })
      .returning();

    return row;
  });
}

/**
 * Exactly one year is current at a time.
 *
 * Done in a transaction because the clearing and the setting must not be
 * separable: a moment with no current year leaves every session without an
 * academicYearId and logs the whole school out.
 */
export async function setCurrentYear(ctx: Ctx, yearId: string) {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(scoped(academicYears, ctx, eq(academicYears.id, yearId)))
      .limit(1);

    if (!target) return null;

    await tx
      .update(academicYears)
      .set({ isCurrent: false })
      .where(
        and(eq(academicYears.schoolId, ctx.schoolId), ne(academicYears.id, yearId))!,
      );

    const [row] = await tx
      .update(academicYears)
      .set({ isCurrent: true })
      .where(eq(academicYears.id, yearId))
      .returning();

    await tx.insert(auditLog).values({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      entity: "academic_year",
      entityId: yearId,
      action: "set_current",
    });

    return row;
  });
}
