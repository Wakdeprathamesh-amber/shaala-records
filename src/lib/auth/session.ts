import "server-only";

import { and, eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db/client";
import { academicYears, schools, sessions, users } from "@/db/schema";
import { AuthorizationError, hasRole, type Ctx, type Role } from "@/lib/tenant";

import {
  generateToken,
  hashToken,
  isExpired,
  nextExpiry,
  shouldRefresh,
} from "./session-token";

export { SESSION_COOKIE } from "./session-cookie";
import { SESSION_COOKIE } from "./session-cookie";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  // Supabase and any real deployment are HTTPS; localhost is not.
  secure: process.env.NODE_ENV === "production",
} as const;

/**
 * Issues a session and sets the cookie.
 * Only callable from a Server Action or Route Handler — Server Components
 * cannot write cookies.
 */
export async function createSession(
  userId: string,
  schoolId: string,
): Promise<void> {
  const token = generateToken();
  const expiresAt = nextExpiry();

  await db.insert(sessions).values({
    schoolId,
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, expires: expiresAt });
}

export type SessionUser = {
  ctx: Ctx;
  name: string;
  schoolNameMr: string;
};

/**
 * Resolves the current session, or null. Safe to call from a Server Component.
 *
 * Deviation from the plan: `requireCtx` lives here rather than in tenant.ts,
 * so that tenant.ts stays free of `server-only` and its scoping logic remains
 * directly unit-testable.
 */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      schoolId: users.schoolId,
      role: users.role,
      name: users.name,
      schoolNameMr: schools.nameMr,
      academicYearId: academicYears.id,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(schools, eq(schools.id, users.schoolId))
    // The current academic year is part of Ctx; a school without one is a
    // setup error rather than a login failure, so this is a left-ish join
    // done as inner on purpose — see settings, which guarantees one exists.
    .innerJoin(
      academicYears,
      and(
        eq(academicYears.schoolId, users.schoolId),
        eq(academicYears.isCurrent, true),
      ),
    )
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) return null;

  if (isExpired(row.expiresAt)) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }

  if (shouldRefresh(row.expiresAt)) {
    const expiresAt = nextExpiry();
    await db
      .update(sessions)
      .set({ expiresAt })
      .where(eq(sessions.id, row.sessionId));
    try {
      jar.set(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, expires: expiresAt });
    } catch {
      // Server Components cannot set cookies. The row is already extended, so
      // the cookie will catch up on the next Server Action or Route Handler.
    }
  }

  return {
    ctx: {
      schoolId: row.schoolId,
      userId: row.userId,
      role: row.role,
      academicYearId: row.academicYearId,
    },
    name: row.name,
    schoolNameMr: row.schoolNameMr,
  };
}

/**
 * The gate every Server Action and Route Handler calls first.
 * Throws AuthorizationError; callers turn that into a redirect or a 403.
 */
export async function requireCtx(minRole?: Role): Promise<Ctx> {
  const session = await getSession();
  if (!session) {
    throw new AuthorizationError("No active session", "unauthenticated");
  }
  if (minRole && !hasRole(session.ctx, minRole)) {
    throw new AuthorizationError(
      `Requires ${minRole}; session is ${session.ctx.role}`,
      "forbidden",
    );
  }
  return session.ctx;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/** Housekeeping for expired rows. Called from the login action, which is the
 *  cheapest place to amortise it without adding a cron. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
