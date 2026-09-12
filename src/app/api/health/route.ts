import { NextResponse } from "next/server";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/**
 * Liveness and readiness in one.
 *
 * Checks the database, because a container that answers HTTP while unable to
 * reach Postgres is worse than one that is plainly down — the load balancer
 * keeps sending it traffic and every request fails at the point a clerk
 * presses Save.
 *
 * Deliberately says nothing about versions or connection strings: this
 * endpoint is unauthenticated so the health check can reach it.
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
