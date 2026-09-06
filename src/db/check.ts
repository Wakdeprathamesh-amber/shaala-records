/**
 * Preflight for the database connection. Run with `npm run db:check`.
 *
 * Exists because a bad Supabase connection string fails in several distinct
 * ways that all surface as an unhelpful stack trace, and the difference
 * between them is the difference between a five-second fix and an hour.
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;

function fail(problem: string, fix: string): never {
  console.error(`\n  ✗ ${problem}\n\n    ${fix}\n`);
  process.exit(1);
}

if (!url) {
  fail(
    "DATABASE_URL is not set.",
    "Copy .env.example to .env.local — see docs/SETUP-SUPABASE.md",
  );
}

if (url.includes("PROJECT_REF") || url.includes("PASSWORD")) {
  fail(
    "DATABASE_URL still contains the placeholder values.",
    "Paste your real Supabase connection string into .env.local — see docs/SETUP-SUPABASE.md step 4.",
  );
}

if (url.includes("[") || url.includes("]")) {
  fail(
    "DATABASE_URL still contains square brackets.",
    "Supabase shows the password as [YOUR-PASSWORD]. Replace the brackets too, not just the text inside them.",
  );
}

let host = "";
let port = "";
try {
  const parsed = new URL(url);
  host = parsed.hostname;
  port = parsed.port || "5432";
  if (!parsed.password) {
    fail(
      "DATABASE_URL has no password.",
      "Check you replaced [YOUR-PASSWORD] in the connection string.",
    );
  }
} catch {
  fail(
    "DATABASE_URL is not a valid URL.",
    "If your password contains @ : / # or ?, it must be percent-encoded. Ask Claude to encode it for you.",
  );
}

if (port === "6543") {
  console.warn(
    "\n  ! You are using the transaction pooler (port 6543).\n" +
      "    Migrations need port 5432 — use the Session pooler string instead.\n",
  );
}

const isLocal = /^(localhost|127\.0\.0\.1)$/.test(host);

console.log(`\n  Connecting to ${host}:${port} ...`);

async function main(url: string) {
  const sql = postgres(url, {
    ssl: isLocal ? false : "require",
    prepare: false,
    max: 1,
    connect_timeout: 15,
  });

  try {
    const [{ version }] = await sql`SELECT version()`;
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log(`  ✓ Connected — ${String(version).split(" on ")[0]}`);

    if (tables.length === 0) {
      console.log("\n  Database is empty. Next: npm run db:migrate\n");
    } else {
      const names = tables
        .map((t) => t.table_name)
        .filter((n) => n !== "__drizzle_migrations");
      console.log(`  ✓ ${names.length} tables: ${names.join(", ")}\n`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (/password authentication failed|SASL/i.test(msg)) {
      fail(
        "The database rejected the password.",
        "Reset it at Supabase → Settings → Database → Reset database password, then update .env.local.",
      );
    }
    if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) {
      fail(
        `Cannot resolve the host ${host}.`,
        "Check the hostname, and that the Supabase project finished provisioning.",
      );
    }
    if (/ENETUNREACH/i.test(msg)) {
      fail(
        "Network unreachable — this is almost always the IPv6-only direct connection.",
        "Use the Session pooler string (host contains .pooler.supabase.com) — see docs/SETUP-SUPABASE.md step 3.",
      );
    }
    if (/ETIMEDOUT|CONNECT_TIMEOUT/i.test(msg)) {
      fail(
        "Connection timed out.",
        "A paused free-tier project takes ~30s to wake. Open the Supabase dashboard, wait for it to resume, then retry.",
      );
    }
    fail(
      `Connection failed: ${msg}`,
      "Re-copy the Session pooler string from Supabase → Connect.",
    );
  } finally {
    await sql.end();
  }
}

main(url);
