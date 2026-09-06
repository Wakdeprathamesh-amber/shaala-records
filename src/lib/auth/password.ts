/**
 * Password hashing. bcrypt at cost 12, per PRD principle 7 — no third-party
 * auth service holds our users' credentials.
 */
import { compare, hash } from "bcryptjs";

const COST = 12;

/** bcrypt ignores everything past 72 bytes of input. */
const MAX_BYTES = 72;

/**
 * Thrown when a password is long enough that bcrypt would truncate it.
 *
 * This matters more here than in a typical English-language app: Devanagari
 * characters are three bytes each in UTF-8, so a 25-character Marathi
 * passphrase already exceeds the limit. Truncation is silent, and two
 * different passwords sharing their first 72 bytes would both open the same
 * account. We refuse rather than truncate.
 */
export class PasswordTooLongError extends Error {
  constructor(readonly bytes: number) {
    super(
      `Password is ${bytes} bytes; bcrypt supports at most ${MAX_BYTES}. ` +
        `Note that Marathi characters take 3 bytes each.`,
    );
    this.name = "PasswordTooLongError";
  }
}

export function passwordByteLength(plain: string): number {
  return Buffer.byteLength(plain, "utf8");
}

export async function hashPassword(plain: string): Promise<string> {
  const bytes = passwordByteLength(plain);
  if (bytes > MAX_BYTES) throw new PasswordTooLongError(bytes);
  return hash(plain, COST);
}

/**
 * Returns false for a wrong password *and* for a malformed stored hash, so a
 * corrupted row fails closed as a login failure rather than a 500.
 */
export async function verifyPassword(
  plain: string,
  storedHash: string,
): Promise<boolean> {
  if (passwordByteLength(plain) > MAX_BYTES) return false;
  try {
    return await compare(plain, storedHash);
  } catch {
    return false;
  }
}
