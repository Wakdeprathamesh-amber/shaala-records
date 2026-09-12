import "server-only";

import { redirect } from "next/navigation";

import { AuthorizationError } from "@/lib/tenant";

/**
 * Turns an AuthorizationError into the right user-facing outcome.
 *
 * An unauthenticated request goes back to login with its destination
 * preserved. A forbidden one does not — bouncing a clerk to login when they
 * are already correctly signed in is the kind of loop that makes people think
 * the app is broken.
 */
export function handleAuthError(err: unknown, returnTo?: string): never {
  if (err instanceof AuthorizationError) {
    if (err.kind === "unauthenticated") {
      redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
    }
    redirect("/?forbidden=1");
  }
  throw err;
}
