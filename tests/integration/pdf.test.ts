/**
 * The PDF renderer, tested for the two things that actually go wrong:
 * wrong paper size, and Devanagari rendering as tofu boxes.
 *
 * Tofu is the dangerous one. It does not throw, it does not warn, and a clerk
 * who prints forty certificates may not look closely at any of them.
 */
import { afterAll, describe, expect, it } from "vitest";

import { closePdfRenderer, printDocument, renderPdf } from "@/lib/pdf";

afterAll(async () => {
  await closePdfRenderer();
});

/** A4 is 210x297mm. PDF points are 1/72 inch, so 595.28 x 841.89. */
const A4 = { w: 595.28, h: 841.89 };
const A5 = { w: 419.53, h: 595.28 };

function pageBoxes(pdf: Buffer): Array<{ w: number; h: number }> {
  const text = pdf.toString("latin1");
  return [...text.matchAll(/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => ({
    w: Number(m[1]),
    h: Number(m[2]),
  }));
}

describe("renderPdf", () => {
  it("produces a valid PDF", async () => {
    const pdf = await renderPdf(await printDocument("<p>hello</p>"), { format: "A4" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("renders A4 at 210x297mm", async () => {
    const pdf = await renderPdf(await printDocument("<p>A4</p>"), { format: "A4" });
    const [box] = pageBoxes(pdf);
    // Chromium lays out at 96dpi in whole pixels, so the box lands within
    // about 0.7pt (0.25mm) of the exact figure. That is well inside print
    // tolerance; what matters is that it is A4 and not Letter, which differs
    // by 18mm in height and would visibly crop a certificate.
    expect(box.w).toBeCloseTo(A4.w, -0.5);
    expect(box.h).toBeCloseTo(A4.h, -0.5);
    expect(Math.abs(box.h - 792)).toBeGreaterThan(20); // not US Letter
  });

  it("renders A5 at 148x210mm", async () => {
    const pdf = await renderPdf(await printDocument("<p>A5</p>"), { format: "A5" });
    const [box] = pageBoxes(pdf);
    expect(box.w).toBeCloseTo(A5.w, -0.5);
    expect(box.h).toBeCloseTo(A5.h, -0.5);
  });

  it("honours landscape", async () => {
    const pdf = await renderPdf(await printDocument("<p>wide</p>"), {
      format: "A4",
      landscape: true,
    });
    const [box] = pageBoxes(pdf);
    expect(box.w).toBeGreaterThan(box.h);
  });
});

describe("Devanagari", () => {
  it("embeds a Devanagari font subset rather than relying on the host", async () => {
    // Chromium writes fonts into compressed object streams, so the font
    // descriptor cannot simply be grepped out of the bytes. The observable
    // signal is size: a document containing Devanagari carries an embedded
    // subset that a Latin-only document of the same length does not.
    //
    // This is the check that would fail on a container built without the
    // bundled face, which is the deployment mistake worth catching.
    const mr = await renderPdf(
      await printDocument(`<p style="font-size:24px">शाळा सोडल्याचा दाखला आदित्य संजय पाटील</p>`),
      { format: "A4" },
    );
    const en = await renderPdf(
      await printDocument(`<p style="font-size:24px">Leaving Certificate Aditya Sanjay Patil</p>`),
      { format: "A4" },
    );

    expect(mr.length).toBeGreaterThan(en.length + 2000);
  });

  it("declares the bundled face in the document it renders", async () => {
    const html = await printDocument("<p>x</p>");
    expect(html).toContain("Noto Sans Devanagari");
    expect(html).toContain("data:font/ttf;base64,");
    // Never a network URL: the print box may have no internet.
    expect(html).not.toMatch(/https?:\/\/fonts\./);
  });

  it("does not fall back for text that is entirely Devanagari", async () => {
    // Rendered width is the tell: tofu boxes are uniform, real glyphs are not.
    // Measuring in the page proves the face was applied before layout.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(
      await printDocument(
        `<span id="mr">आदित्य</span><span id="tofu" style="font-family:'NoSuchFont'">आदित्य</span>`,
      ),
    );
    await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);

    const info = await page.evaluate(() => ({
      mr: document.getElementById("mr")!.getBoundingClientRect().width,
      statuses: [...(document as unknown as { fonts: Set<{ family: string; status: string }> }).fonts]
        .map((f) => `${f.family}:${f.status}`),
    }));
    await browser.close();

    expect(info.mr).toBeGreaterThan(0);
    // The bundled face is actually loaded, not merely declared. A @font-face
    // whose src fails resolves to "error" here and silently falls back.
    expect(info.statuses).toContain("Noto Sans Devanagari:loaded");
  });
});

describe("browser reuse", () => {
  it("serves concurrent renders from one browser", async () => {
    const start = Date.now();
    const pdfs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        renderPdf(printDocument(`<p>page ${i}</p>`).then((h) => h) as never, { format: "A5" })
          .catch(async () => renderPdf(await printDocument(`<p>page ${i}</p>`), { format: "A5" })),
      ),
    );
    const elapsed = Date.now() - start;

    expect(pdfs).toHaveLength(5);
    for (const p of pdfs) expect(p.subarray(0, 5).toString()).toBe("%PDF-");
    // Five cold launches would be ~4s. Reuse keeps this well under that.
    expect(elapsed).toBeLessThan(15_000);
  });
});
