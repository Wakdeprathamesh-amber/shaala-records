/**
 * Onboards a school: profile, current academic year, one principal login and
 * the document serial counters.
 *
 * Run with `npm run db:create-school -- --config path/to/school.json`.
 *
 * Deliberately separate from seed.ts. The seed deletes and recreates its demo
 * school every run; this creates a real tenant and refuses to touch one that
 * already exists, because a second run against a live school would be a
 * catastrophe rather than an inconvenience.
 *
 * The principal's password is generated here and printed once. It is never
 * written to a file, so there is nothing to leak if the config is committed
 * or emailed.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import { hashPassword } from "../lib/auth/password";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url || url.includes("PROJECT_REF")) {
  console.error("\n  ✗ DATABASE_URL is not configured — see docs/SETUP-SUPABASE.md\n");
  process.exit(1);
}

type SchoolConfig = {
  /** Mirrors the Settings form, so a school can be onboarded from a file or
   *  through the screen and end up with the same profile either way. */
  school: Record<string, string | undefined> & {
    nameMr: string;
    nameEn: string;
    udiseCode: string;
  };
  academicYear: { label: string; startDate: string; endDate: string };
  principal: { name: string; email?: string; phone?: string };
};

function readConfig(): SchoolConfig {
  const i = process.argv.indexOf("--config");
  const path = i >= 0 ? process.argv[i + 1] : undefined;
  if (!path) {
    console.error("\n  usage: npm run db:create-school -- --config <file.json>\n");
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8")) as SchoolConfig;
}

/** Readable, unambiguous, and long enough: no l/I/O/0 to misread over a phone. */
function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(16))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

const isLocal = /@(localhost|127\.0\.0\.1)/.test(url);
const sql = postgres(url, { ssl: isLocal ? false : "require", prepare: false, max: 1 });
const db = drizzle(sql, { schema, casing: "snake_case" });

const { schools, academicYears, users, documentCounters } = schema;

async function main() {
  const cfg = readConfig();

  if (!cfg.principal.email && !cfg.principal.phone) {
    throw new Error("The principal needs an email or a phone number — it is how they sign in.");
  }

  const [existing] = await db
    .select({ id: schools.id, nameEn: schools.nameEn })
    .from(schools)
    .where(eq(schools.udiseCode, cfg.school.udiseCode))
    .limit(1);

  if (existing) {
    console.error(
      `\n  ✗ A school with UDISE ${cfg.school.udiseCode} already exists (${existing.nameEn}).` +
        `\n    Refusing to touch it. Edit the profile in Settings instead.\n`,
    );
    process.exit(1);
  }

  // Blank strings from a hand-edited config become NULL, so the certificate
  // omits the line rather than printing an empty label.
  const profile = Object.fromEntries(
    Object.entries(cfg.school).map(([k, v]) => [k, v === "" ? null : v]),
  );
  const [school] = await db.insert(schools).values(profile as never).returning();

  const [year] = await db
    .insert(academicYears)
    .values({ schoolId: school.id, ...cfg.academicYear, isCurrent: true })
    .returning();

  const password = generatePassword();
  await db.insert(users).values({
    schoolId: school.id,
    name: cfg.principal.name,
    email: cfg.principal.email ?? null,
    phone: cfg.principal.phone ?? null,
    role: "principal",
    passwordHash: await hashPassword(password),
  });

  await db.insert(documentCounters).values(
    (["lc", "bonafide", "id_card", "character", "noc"] as const).map((docType) => ({
      schoolId: school.id,
      docType,
      nextSerial: 1,
    })),
  );

  console.log(`\n  ✓ ${school.nameMr}`);
  console.log(`    ${school.nameEn}`);
  console.log(`    UDISE ${school.udiseCode} · academic year ${year.label}`);
  console.log(`\n  Principal login`);
  console.log(`    ${cfg.principal.email ?? cfg.principal.phone}`);
  console.log(`    ${password}`);
  console.log(`\n  Shown once. Give it to them directly, not over email, and have`);
  console.log(`  them change it in Settings after the first sign-in.\n`);
  console.log(`  Serial counters start at 1 for all five document types. If this`);
  console.log(`  school's paper register is already at, say, LC 447, set that in`);
  console.log(`  Settings before issuing anything — see docs/RUNBOOK.md.\n`);
}

main()
  .catch((err) => {
    console.error("\n  ✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => sql.end());
