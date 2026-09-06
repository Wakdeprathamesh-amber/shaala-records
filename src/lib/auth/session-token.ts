/**
 * Pure session arithmetic — no database, no cookies, no `server-only`, so it
 * can be unit tested directly. The stateful half lives in ./session.ts.
 */
import { createHash, randomBytes } from "node:crypto";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Refresh once the session has under a week left, so a clerk who uses the
 *  app daily is never logged out mid-task, while an abandoned session still
 *  dies on schedule. */
export const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** 32 bytes = 256 bits. base64url so it is safe in a cookie unescaped. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * What actually goes in the database. Session tokens are bearer credentials:
 * storing them raw would mean a leaked dump hands the reader every live
 * session. SHA-256 is right here — unlike a password, the input is already
 * 256 bits of uniform randomness, so there is nothing for a slow hash to
 * protect against.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function nextExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** True when a live session is close enough to expiry to be worth extending. */
export function shouldRefresh(expiresAt: Date, now: Date = new Date()): boolean {
  if (isExpired(expiresAt, now)) return false;
  return expiresAt.getTime() - now.getTime() < REFRESH_WINDOW_MS;
}
