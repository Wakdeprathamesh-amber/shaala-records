/**
 * The demographic register must be one landscape A4 sheet.
 *
 * It is handed to an inspector as a single page; a register that runs to two
 * separates the totals row from the rows it totals. Guarded here the same way
 * the leaving certificate is.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { closePdfRenderer, printDocument, renderPdf } from "@/lib/pdf";
import { buildDemographicTable, type Cell } from "@/domain/reports/pivot";
import { CATEGORIES } from "@/domain/students/schema";
import { DEMOGRAPHIC_CSS, DemographicRegister } from "@/templates/demographic";

afterAll(async () => {
  await closePdfRenderer();
});

const school = {
  nameMr: "जिल्हा परिषद प्राथमिक व माध्यमिक विद्यालय, वडगाव बुद्रुक",
  nameEn: "Zilla Parishad Primary and Secondary School, Wadgaon Budruk",
  udiseCode: "27251000101",
  taluka: "हवेली",
  district: "पुणे",
  principalNameMr: "श्रीमती. सुनीता रामचंद्र देशपांडे",
};

/** Every category, every gender, in every one of N classes. */
function cellsFor(classes: string[], withUnknown = false): Cell[] {
  const out: Cell[] = [];
  for (const c of classes)
    for (const cat of CATEGORIES)
      for (const g of ["male", "female"]) out.push({ class: c, category: cat, gender: g, n: 12 });
  if (withUnknown) out.push({ class: classes[0], category: null, gender: "other", n: 1 });
  return out;
}

async function render(classes: string[], withUnknown = false) {
  const html = await printDocument(
    renderToStaticMarkup(
      createElement(DemographicRegister, {
        school,
        yearLabel: "2026-27",
        table: buildDemographicTable(cellsFor(classes, withUnknown)),
        generatedOn: "2026-09-13",
      }),
    ),
    DEMOGRAPHIC_CSS,
  );
  const pdf = await renderPdf(html, { format: "A4", landscape: true });
  const pages = (pdf.toString("latin1").match(/MediaBox/g) ?? []).length;
  return { html, pages };
}

/** Where the overflow is, in CSS pixels, against A4 landscape 1123×794. */
async function measure(html: string) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1123, height: 794 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    tableWidth: document.querySelector("table.reg")!.getBoundingClientRect().width,
    tableHeight: document.querySelector("table.reg")!.getBoundingClientRect().height,
  }));
  await browser.close();
  return m;
}

describe("demographic register pagination", () => {
  it("fits six classes on one landscape page (the pilot school)", async () => {
    const { html, pages } = await render(["5", "6", "7", "8", "9", "10"], true);
    const m = await measure(html);
    console.log("6 classes:", JSON.stringify(m), `→ ${pages} page(s)`);
    expect(pages).toBe(1);
  });

  it("fits all twelve classes on one landscape page", async () => {
    const classes = Array.from({ length: 12 }, (_, i) => String(i + 1));
    const { html, pages } = await render(classes, true);
    const m = await measure(html);
    console.log("12 classes:", JSON.stringify(m), `→ ${pages} page(s)`);
    expect(pages).toBe(1);
  });

  it("still carries the totals row and both signatures", async () => {
    const { html } = await render(["1", "2"]);
    expect(html).toContain("मुख्याध्यापक");
    expect(html).toContain("लिपिक");
    expect((html.match(/एकूण/g) ?? []).length).toBeGreaterThan(2);
  });
});
