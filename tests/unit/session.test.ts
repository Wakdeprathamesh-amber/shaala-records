import { describe, expect, it } from "vitest";

import {
  SESSION_TTL_MS,
  generateToken,
  hashToken,
  isExpired,
  nextExpiry,
  shouldRefresh,
} from "@/lib/auth/session-token";

describe("generateToken()", () => {
  it("produces a URL-safe token with no padding", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("carries at least 256 bits of entropy", () => {
    // 32 bytes base64url-encoded is 43 characters.
    expect(generateToken().length).toBeGreaterThanOrEqual(43);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 500 }, generateToken));
    expect(seen.size).toBe(500);
  });
});

describe("hashToken()", () => {
  it("is deterministic", () => {
    expect(hashToken("abc")).toEqual(hashToken("abc"));
  });

  it("differs for different tokens", () => {
    expect(hashToken("abc")).not.toEqual(hashToken("abd"));
  });

  it("does not leak the token", () => {
    const t = generateToken();
    expect(hashToken(t)).not.toContain(t);
  });
});

describe("expiry", () => {
  const now = new Date("2026-09-06T12:00:00Z");

  it("sets expiry 30 days out", () => {
    expect(nextExpiry(now).getTime() - now.getTime()).toBe(SESSION_TTL_MS);
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("treats a past expiry as expired", () => {
    expect(isExpired(new Date("2026-09-05T12:00:00Z"), now)).toBe(true);
  });

  it("treats a future expiry as live", () => {
    expect(isExpired(new Date("2026-09-07T12:00:00Z"), now)).toBe(false);
  });

  it("treats the exact expiry instant as expired", () => {
    expect(isExpired(now, now)).toBe(true);
  });
});

describe("shouldRefresh() — rolling sessions", () => {
  const now = new Date("2026-09-06T12:00:00Z");
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86_400_000);

  it("does not refresh a session that was just issued", () => {
    expect(shouldRefresh(daysFromNow(30), now)).toBe(false);
  });

  it("refreshes once the session is inside its final week", () => {
    expect(shouldRefresh(daysFromNow(6), now)).toBe(true);
  });

  it("does not refresh an already-expired session", () => {
    // An expired session must be rejected, not silently extended.
    expect(shouldRefresh(daysFromNow(-1), now)).toBe(false);
  });
});
