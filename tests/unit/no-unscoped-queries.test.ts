/**
 * Structural guardrail, not a behaviour test.
 *
 * Tenant scoping only holds if every query goes through the repository layer.
 * A future contributor — human or agent — who writes `db.select().from(students)`
 * inside a page or a Server Action bypasses scoped() entirely, and nothing at
 * runtime will complain. This test is what complains.
 *
 * If this fails: move the query into the relevant src/domain/<area>/repo.ts and
 * have it take Ctx as its first argument.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(import.meta.dirname, "..", "..", "src");

/**
 * Files permitted to touch the query builder directly.
 *
 * Repositories are the normal home for queries. The two other entries are
 * deliberate, documented exceptions rather than convenience:
 *
 * - `lib/auth/session.ts` runs before a Ctx exists — the session lookup is
 *   what produces one.
 * - `domain/documents/issue.ts` is a transaction boundary. Serial allocation,
 *   the document row, the LC detail, the status change and the audit entry
 *   must all commit or all fail together, and repository functions each open
 *   their own transaction, so they cannot be composed into one.
 *
 * Every exception is re-checked below: it must still scope by tenant.
 */
const TRANSACTIONAL_EXCEPTIONS = [
  "lib/auth/session.ts",
  "domain/documents/issue.ts",
];

function relPath(file: string): string {
  return relative(SRC, file).split(sep).join("/");
}

function isAllowed(file: string): boolean {
  const rel = relPath(file);
  return (
    rel.startsWith("db/") ||
    /^domain\/[^/]+\/repo\.ts$/.test(rel) ||
    TRANSACTIONAL_EXCEPTIONS.includes(rel)
  );
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

// db.select(...), db.insert(...), db.update(...), db.delete(...) and
// tx.<same>, which is how they appear inside a transaction.
const QUERY = /\b(?:db|tx)\s*\.\s*(?:select|insert|update|delete)\s*\(/;

describe("no unscoped queries", () => {
  it("keeps the query builder inside the repository layer", () => {
    const offenders = walk(SRC)
      .filter((f) => !isAllowed(f))
      .flatMap((file) => {
        const lines = readFileSync(file, "utf8").split("\n");
        return lines
          .map((line, i) => ({ line, i }))
          .filter(({ line }) => QUERY.test(line) && !line.trimStart().startsWith("*"))
          .map(({ i }) => `${relative(SRC, file)}:${i + 1}`);
      });

    expect(
      offenders,
      `Query builder used outside the repository layer:\n  ${offenders.join("\n  ")}\n\n` +
        `Move these into src/domain/<area>/repo.ts and pass Ctx as the first argument.`,
    ).toEqual([]);
  });

  it("checks files it can actually see (guards against a broken glob)", () => {
    // If the walk silently returned nothing, the test above would pass vacuously.
    expect(walk(SRC).length).toBeGreaterThan(0);
  });

  it("still requires every exception to scope by tenant", () => {
    // An exception buys the right to hold its own transaction, not the right
    // to skip the WHERE clause. session.ts is excluded because it is what
    // establishes the tenant in the first place.
    const mustScope = TRANSACTIONAL_EXCEPTIONS.filter((f) => f !== "lib/auth/session.ts");

    for (const rel of mustScope) {
      const source = readFileSync(join(SRC, rel), "utf8");
      expect(source, `${rel} must filter by tenant`).toMatch(/scoped\(|ctx\.schoolId/);
    }
  });

  it("keeps the exception list short", () => {
    // If this number starts climbing, the tenant rule is being eroded one
    // convenient exception at a time.
    expect(TRANSACTIONAL_EXCEPTIONS.length).toBeLessThanOrEqual(3);
  });
});
