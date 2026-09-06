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

/** Only these may touch the query builder directly. */
function isAllowed(file: string): boolean {
  const rel = relative(SRC, file).split(sep).join("/");
  return (
    rel.startsWith("db/") ||
    /^domain\/[^/]+\/repo\.ts$/.test(rel) ||
    rel === "lib/auth/session.ts" // sessions are looked up before a Ctx exists
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
});
