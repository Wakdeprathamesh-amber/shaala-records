/**
 * The proxy matcher decides what is behind the login gate.
 *
 * Getting it wrong fails in two opposite and equally bad ways: too broad and
 * the container healthcheck gets redirected to /login so the deployment never
 * reports healthy; too narrow and a page serving children's data is reachable
 * without a session.
 */
import { describe, expect, it } from "vitest";

import { config } from "@/proxy";

const matcher = new RegExp(`^${config.matcher[0]}$`);
const matches = (path: string) => matcher.test(path);

describe("paths the proxy must guard", () => {
  it.each([
    "/",
    "/students",
    "/students/abc-123",
    "/students/new",
    "/documents",
    "/documents/issue",
    "/exports",
    "/import",
    "/settings",
    "/api/documents/abc/pdf",
    "/api/exports/file",
  ])("guards %s", (path) => {
    expect(matches(path)).toBe(true);
  });
});

describe("paths the proxy must not touch", () => {
  it("leaves the health endpoint open", () => {
    // The container healthcheck and Caddy's upstream probe carry no cookie.
    // If this is guarded, the deployment never reports healthy.
    expect(matches("/api/health")).toBe(false);
  });

  it("leaves Next internals alone", () => {
    expect(matches("/_next/static/chunks/main.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
  });

  it("leaves static assets alone", () => {
    for (const p of ["/favicon.ico", "/logo.svg", "/photo.jpg", "/scan.png"]) {
      expect(matches(p), p).toBe(false);
    }
  });
});

describe("the login page itself", () => {
  it("is matched, because the proxy redirects an already-signed-in user away", () => {
    expect(matches("/login")).toBe(true);
  });
});
