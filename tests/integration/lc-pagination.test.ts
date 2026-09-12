/**
 * A leaving certificate must be one page.
 *
 * A second page is not cosmetic: the signature block ends up on a sheet with
 * no content, schools print duplex onto certificate stationery, and a
 * certificate whose signatures are on a separate leaf is rejected by the
 * offices it is presented to.
 */
import { afterAll, describe, expect, it } from "vitest";

import { closePdfRenderer } from "@/lib/pdf";
import { documentHtml, renderDocumentPdf } from "@/domain/documents/render";
import type { DocumentPayload } from "@/domain/documents/issue";

afterAll(async () => {
  await closePdfRenderer();
});

/** The worst case: every optional field populated with a long value. */
const worstCase: DocumentPayload = {
  version: 1,
  docType: "lc",
  issuedOn: "2026-09-12",
  serialNo: 1247,
  isDuplicate: false,
  schoolNameMr: "जिल्हा परिषद प्राथमिक व माध्यमिक विद्यालय, वडगाव बुद्रुक",
  schoolNameEn: "Zilla Parishad Primary and Secondary School, Wadgaon Budruk",
  udiseCode: "27251000101",
  boardIndex: "P-11.1.001",
  schoolAddress: "मु. पो. वडगाव बुद्रुक, ता. हवेली, जि. पुणे ४११०५१",
  taluka: "हवेली",
  district: "पुणे",
  principalNameMr: "श्रीमती. सुनीता रामचंद्र देशपांडे-कुलकर्णी",
  grNumber: "1001",
  grNumberMr: "एक हजार एक",
  apaarId: "123456789012",
  studentNameMr: "आदित्य संजय पाटील-देशमुख",
  studentNameEn: "Aditya Sanjay Patil-Deshmukh",
  motherNameMr: "सौ. संजीवनी संजय पाटील-देशमुख",
  fatherNameMr: "श्री. संजय बाळासाहेब पाटील-देशमुख",
  dob: "2010-01-01",
  dobInWordsMr: "एक जानेवारी दोन हजार दहा",
  birthVillage: "वडगाव बुद्रुक",
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
  dateOfLeaving: "2027-04-30",
  lastAttended: "2027-04-28",
  reasonMr: "पालकांच्या नोकरीतील बदलीमुळे व पुढील शिक्षणासाठी",
  progress: "समाधानकारक",
  conduct: "चांगले",
  duesCleared: true,
  remarksMr: "सर्व देणी दिली आहेत. कोणतीही थकबाकी नाही.",
};

function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/MediaBox/g) ?? []).length;
}

describe("leaving certificate pagination", () => {
  it("fits on one page with every field populated", async () => {
    const pdf = await renderDocumentPdf(worstCase);
    expect(pageCount(pdf)).toBe(1);
  });

  it("fits on one page as a duplicate, which adds a banner", async () => {
    const pdf = await renderDocumentPdf({ ...worstCase, isDuplicate: true });
    expect(pageCount(pdf)).toBe(1);
  });

  it("fits on one page with the header suppressed", async () => {
    const pdf = await renderDocumentPdf(worstCase, { suppressHeader: true });
    expect(pageCount(pdf)).toBe(1);
  });

  it("still contains the signature block, so it did not fit by truncation", async () => {
    const html = await documentHtml(worstCase);
    expect(html).toContain("मुख्याध्यापक");
  });

  it("keeps a bonafide on one page too", async () => {
    const pdf = await renderDocumentPdf({ ...worstCase, docType: "bonafide", purpose: "caste" });
    expect(pageCount(pdf)).toBe(1);
  });
});
