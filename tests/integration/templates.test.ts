/**
 * Renders each certificate from a representative snapshot and checks the
 * statutory content is present.
 *
 * Also writes the PDFs to /tmp so they can be looked at. A template test that
 * only asserts on strings will happily pass while the layout is unreadable.
 */
import { afterAll, describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";

import { closePdfRenderer } from "@/lib/pdf";
import { documentHtml, renderDocumentPdf, renderIdCardSheets } from "@/domain/documents/render";
import type { DocumentPayload } from "@/domain/documents/issue";

const base = {
  version: 1 as const,
  issuedOn: "2026-09-12",
  serialNo: 7,
  isDuplicate: false,
  schoolNameMr: "जिल्हा परिषद प्राथमिक व माध्यमिक विद्यालय, वडगाव",
  schoolNameEn: "Zilla Parishad Primary & Secondary School, Wadgaon",
  udiseCode: "27251000101",
  boardIndex: "P-11.1.001",
  schoolAddress: "मु. पो. वडगाव, ता. हवेली",
  taluka: "हवेली",
  district: "पुणे",
  principalNameMr: "श्रीमती. सुनीता रामचंद्र देशपांडे",
  grNumber: "1001",
  grNumberMr: "एक हजार एक",
  apaarId: "123456789012",
  studentNameMr: "आदित्य संजय पाटील",
  studentNameEn: "Aditya Sanjay Patil",
  motherNameMr: "सौ. संजाबाई पाटील",
  fatherNameMr: "संजय पाटील",
  dob: "2010-01-01",
  dobInWordsMr: "एक जानेवारी दोन हजार दहा",
  birthVillage: "वडगाव",
  birthTaluka: "हवेली",
  birthDistrict: "पुणे",
  birthState: "महाराष्ट्र",
  caste: "मराठा",
  subCaste: "कुणबी",
  category: "OPEN",
  religion: "हिंदू",
  nationality: "Indian",
  motherTongue: "मराठी",
  bloodGroup: "B+",
  admissionDate: "2020-06-15",
  admissionClass: "1",
  lastClassPassed: "9",
  currentClass: "10",
  currentDivision: "अ",
  academicYear: "2026-27",
};

const lc: DocumentPayload = {
  ...base,
  docType: "lc",
  dateOfLeaving: "2027-04-30",
  lastAttended: "2027-04-28",
  reasonMr: "पुढील शिक्षणासाठी",
  progress: "समाधानकारक",
  conduct: "चांगले",
  duesCleared: true,
  remarksMr: null,
};

const bonafide: DocumentPayload = { ...base, docType: "bonafide", purpose: "scholarship" };
const idCard: DocumentPayload = { ...base, docType: "id_card" };

afterAll(async () => {
  await closePdfRenderer();
});

describe("leaving certificate", () => {
  it("carries every statutory field", async () => {
    const html = await documentHtml(lc);
    for (const needed of [
      "शाळा सोडल्याचा दाखला",
      lc.studentNameMr,
      lc.motherNameMr!,
      lc.fatherNameMr!,
      lc.caste!,
      lc.subCaste!,
      lc.nationality!,
      lc.birthVillage!,
      lc.reasonMr!,
      lc.conduct!,
      lc.progress!,
      lc.principalNameMr!,
      "मुख्याध्यापक",
      "वर्गशिक्षक",
      "लिपिक",
    ]) {
      expect(html, `missing: ${needed}`).toContain(needed);
    }
  });

  it("prints the date of birth in both figures and words", async () => {
    const html = await documentHtml(lc);
    expect(html).toContain("०१/०१/२०१०");       // figures, Devanagari
    expect(html).toContain("एक जानेवारी दोन हजार दहा"); // words
  });

  it("prints the UDISE code and board index", async () => {
    const html = await documentHtml(lc);
    expect(html).toContain("२७२५१०००१०१");
    expect(html).toContain("P-11.1.001");
  });

  it("marks a duplicate prominently", async () => {
    const html = await documentHtml({ ...lc, isDuplicate: true });
    expect(html).toContain("द्वितीय प्रत");
    expect(html).toContain("watermark");
  });

  it("does not mark an original", async () => {
    expect(await documentHtml(lc)).not.toContain("द्वितीय प्रत");
  });

  it("suppresses the header for pre-printed stationery", async () => {
    const normal = await documentHtml(lc);
    const suppressed = await documentHtml(lc, { suppressHeader: true });
    // Match on a fragment without "&", which React escapes to &amp;.
    expect(normal).toContain("Zilla Parishad Primary");
    expect(suppressed).not.toContain("Zilla Parishad Primary");
    expect(normal).toContain(lc.schoolNameMr);
    expect(suppressed).not.toContain(lc.schoolNameMr);
    // The title still prints — only the letterhead is left to the stationery.
    expect(suppressed).toContain("शाळा सोडल्याचा दाखला");
  });

  it("renders to an A4 PDF", async () => {
    const pdf = await renderDocumentPdf(lc);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    await writeFile("/tmp/shaala-lc.pdf", pdf);
    await writeFile("/tmp/shaala-lc-duplicate.pdf", await renderDocumentPdf({ ...lc, isDuplicate: true }));
  });
});

describe("bonafide", () => {
  it("states the sentence the purpose requires", async () => {
    const scholarship = await documentHtml({ ...bonafide, purpose: "scholarship" });
    const passport = await documentHtml({ ...bonafide, purpose: "passport" });
    const bank = await documentHtml({ ...bonafide, purpose: "bank" });

    expect(scholarship).toContain("शिष्यवृत्ती");
    expect(passport).toContain("पासपोर्ट");
    expect(passport).toContain("राष्ट्रीयत्व");
    expect(bank).toContain("बँक खाते");
    // Each purpose really does differ, rather than sharing boilerplate.
    expect(scholarship).not.toBe(passport);
  });

  it("covers all five statutory purposes plus other", async () => {
    for (const purpose of ["scholarship", "bank", "passport", "caste", "domicile", "other"] as const) {
      const html = await documentHtml({ ...bonafide, purpose });
      expect(html, purpose).toContain("बोनाफाईड प्रमाणपत्र");
    }
  });

  it("renders to PDF", async () => {
    const pdf = await renderDocumentPdf(bonafide);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    await writeFile("/tmp/shaala-bonafide.pdf", pdf);
  });
});

describe("id card", () => {
  it("shows name in both scripts, class, GR and blood group", async () => {
    const html = await documentHtml(idCard);
    expect(html).toContain(idCard.studentNameMr);
    expect(html).toContain(idCard.studentNameEn);
    expect(html).toContain("B+");
    expect(html).toContain("१००१");
  });

  it("batches eight to an A4 sheet", async () => {
    const cards = Array.from({ length: 19 }, (_, i) => ({
      ...idCard,
      grNumber: String(1000 + i),
      serialNo: i + 1,
      studentNameMr: `विद्यार्थी ${i + 1}`,
    }));
    const pdf = await renderIdCardSheets(cards);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    // 19 cards is three sheets: 8 + 8 + 3.
    const pages = (pdf.toString("latin1").match(/MediaBox/g) ?? []).length;
    expect(pages).toBe(3);
    await writeFile("/tmp/shaala-idcards.pdf", pdf);
  });
});
