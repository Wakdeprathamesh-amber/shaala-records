import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Browser } from "playwright";

export type PaperFormat = "A4" | "A5";

export type RenderOptions = {
  format: PaperFormat;
  landscape?: boolean;
  marginMm?: number;
};

/**
 * One Chromium for the lifetime of the process.
 *
 * Launching per request costs roughly 800ms. Issuing ID cards for a class of
 * forty would spend half a minute doing nothing but starting browsers, and on
 * a nano instance that is enough to time the request out entirely.
 */
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({
        args: [
          // Required in the production container, harmless in development.
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--font-render-hinting=none",
        ],
      });
    })().catch((err) => {
      // Do not cache a failed launch — the next request should retry rather
      // than inherit a permanently rejected promise.
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

let fontDataUri: string | null = null;

/**
 * The bundled Devanagari face, as a data URI.
 *
 * Embedded rather than linked so Chromium never resolves a filesystem path —
 * those differ between the development Mac and the production container, and
 * a missing font does not error, it silently renders tofu boxes onto a legal
 * document.
 */
async function getFontDataUri(): Promise<string> {
  if (!fontDataUri) {
    const file = path.join(process.cwd(), "src/assets/fonts/NotoSansDevanagari.ttf");
    const buf = await readFile(file);
    fontDataUri = `data:font/ttf;base64,${buf.toString("base64")}`;
  }
  return fontDataUri;
}

/** Wraps body HTML in a document carrying the embedded font and print rules. */
export async function printDocument(bodyHtml: string, css = ""): Promise<string> {
  const font = await getFontDataUri();
  return `<!doctype html>
<html lang="mr">
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: "Noto Sans Devanagari";
    src: url("${font}") format("truetype");
    font-weight: 100 900;
    font-display: block;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Noto Sans Devanagari", serif;
    color: #000;
    background: #fff;
    /* Devanagari matras sit above the line; tight leading collides them. */
    line-height: 1.65;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { margin: 0; }
${css}
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/**
 * Renders HTML to PDF at an exact paper size. Callers never manage the browser.
 */
export async function renderPdf(
  html: string,
  opts: RenderOptions,
): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.setContent(html, { waitUntil: "load" });
    // The font is embedded, so this resolves without network access. Without
    // it Chromium can begin printing before the face is applied.
    await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);

    const margin = `${opts.marginMm ?? 0}mm`;

    const pdf = await page.pdf({
      format: opts.format,
      landscape: opts.landscape ?? false,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: margin, right: margin, bottom: margin, left: margin },
    });

    return Buffer.from(pdf);
  } finally {
    await context.close();
  }
}

/** Closes the shared browser. For test teardown and graceful shutdown. */
export async function closePdfRenderer(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    browserPromise = null;
    await browser?.close();
  }
}
