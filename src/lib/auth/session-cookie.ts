/** Shared between src/proxy.ts and src/lib/auth/session.ts. Kept in its own
 *  module so proxy.ts does not import `server-only` transitively. */
export const SESSION_COOKIE = "shaala_session";
