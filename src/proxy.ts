/**
 * Next.js 16 renamed Middleware to Proxy. Same behaviour, same `config.matcher`.
 * See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
 *
 * This is an OPTIMISTIC check only: it looks for the presence of a session
 * cookie so that a logged-out visitor is bounced to /login without a database
 * round trip on every request. It deliberately does not validate the session —
 * the Next.js docs are explicit that Proxy is not a substitute for
 * authorization, and a forged cookie would sail straight through here.
 *
 * Every Server Action and Route Handler still calls requireCtx(), which is
 * where authorization actually happens.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

export function proxy(request: NextRequest) {
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!hasCookie && !isLoginPage) {
    const url = new URL("/login", request.url);
    // Send them back where they were trying to go once they authenticate.
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (hasCookie && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the login POST target, and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
