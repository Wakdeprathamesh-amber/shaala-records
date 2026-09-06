import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in — see docs/SETUP-SUPABASE.md",
  );
}

const isLocal = /@(localhost|127\.0\.0\.1)/.test(url);

const client = postgres(url, {
  // Supabase terminates TLS at the pooler and rejects plaintext. Local
  // Postgres generally has no certificate, so only require it off-box.
  ssl: isLocal ? false : "require",

  // Supabase's transaction pooler (port 6543) cannot support prepared
  // statements, and the session pooler only sometimes can depending on how
  // connections get reused. Disabling them costs a little planning time per
  // query and makes the app correct against every Supabase connection mode
  // as well as plain Postgres.
  prepare: false,

  // The free tier caps total connections fairly low, and Next.js dev opens a
  // fresh module graph on every hot reload.
  max: isLocal ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 15,
});

/**
 * Next.js hot-reloads server modules on every edit, which would otherwise
 * open a new pool each time and exhaust the database's connection limit
 * within a few minutes of development.
 */
const globalForDb = globalThis as unknown as {
  __shaalaDb?: ReturnType<typeof drizzle<typeof schema>>;
};

export const db =
  globalForDb.__shaalaDb ?? drizzle(client, { schema, casing: "snake_case" });

if (process.env.NODE_ENV !== "production") globalForDb.__shaalaDb = db;

export { schema };
