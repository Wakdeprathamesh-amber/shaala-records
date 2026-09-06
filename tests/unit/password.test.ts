import { describe, expect, it } from "vitest";
import { getRounds } from "bcryptjs";

import { hashPassword, verifyPassword, PasswordTooLongError } from "@/lib/auth/password";

describe("password hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("shaala-pilot-2026");
    expect(await verifyPassword("shaala-pilot-2026", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("shaala-pilot-2026");
    expect(await verifyPassword("shaala-pilot-2027", hash)).toBe(false);
  });

  it("uses cost 12", async () => {
    expect(getRounds(await hashPassword("whatever-long-enough"))).toBe(12);
  });

  it("salts — the same password hashes differently each time", async () => {
    const a = await hashPassword("same-password-twice");
    const b = await hashPassword("same-password-twice");
    expect(a).not.toEqual(b);
    expect(await verifyPassword("same-password-twice", a)).toBe(true);
    expect(await verifyPassword("same-password-twice", b)).toBe(true);
  });

  it("accepts a Marathi password within the byte limit", async () => {
    const mr = "पासवर्ड२०२६"; // 11 chars, 31 bytes
    const hash = await hashPassword(mr);
    expect(await verifyPassword(mr, hash)).toBe(true);
  });

  it("refuses a password bcrypt would silently truncate", async () => {
    // 25 Devanagari characters = 75 bytes > bcrypt's 72-byte limit.
    // Without this guard, two different passwords could authenticate the
    // same account.
    const tooLong = "अ".repeat(25);
    expect(Buffer.byteLength(tooLong, "utf8")).toBeGreaterThan(72);
    await expect(hashPassword(tooLong)).rejects.toThrow(PasswordTooLongError);
  });

  it("counts bytes, not characters, when applying the limit", async () => {
    // 72 ASCII characters is exactly at the limit and must be allowed.
    const ascii = "a".repeat(72);
    await expect(hashPassword(ascii)).resolves.toBeTypeOf("string");
  });

  it("returns false rather than throwing on a malformed stored hash", async () => {
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
  });
});
