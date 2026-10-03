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
  sansthaNameMr: "सरस्वती प्रतिष्ठान दधीचींना प्रणाम संस्थेचे",
  mottoMr: "तमसो मा ज्योतिर्गमय",
  recognitionNo: "S 11.03.011",
  jrCollegeIndexNo: "J 11.03.016",
  recognitionDetailsMr:
    "शाळा मान्यता क्रमांक १९ सप्टेंबर १९८३ SSN - 1083/6797 N mash · जा.क्र.शि.उसं/उमाशि/पुवि/स्वअंशगा/मान्यता/१४-१५/९०२७/३० शिक्षण उपसंचालक पुणे विभाग पुणे दि. २९/४/२०१४",
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
  studentId: "20162725030730100001",
  studentNameMr: "आदित्य संजय पाटील",
  studentNameEn: "Aditya Sanjay Patil",
  gender: "male" as const,
  photoDataUri: null,
  logoDataUri: null,
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
  casteCertNo: "MH/PUN/2019/0044821",
  category: "OPEN",
  religion: "हिंदू",
  nationality: "Indian",
  motherTongue: "मराठी",
  bloodGroup: "B+",
  admissionDate: "2020-06-15",
  admissionClass: "1",
  previousSchool: "जिल्हा परिषद प्राथमिक शाळा, रावडी",
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

  it("prints the trust, motto and recognition numbers from the letterhead", async () => {
    const html = await documentHtml(lc);
    expect(html).toContain("सरस्वती प्रतिष्ठान");   // trust, above the school name
    expect(html).toContain("तमसो मा ज्योतिर्गमय");  // motto, at the very top
    // Figures go Devanagari, as their own letterhead prints them; the letter
    // prefix and the dots stay put.
    expect(html).toContain("S ११.०३.०११");        // शाळेचा मान्यता क्र.
    expect(html).toContain("J ११.०३.०१६");        // ज्यु. कॉलेज इंडेक्स नं.
    expect(html).toContain("SSN - 1083/6797");      // recognition order line
  });

  it("omits the identity block cleanly when a school has not filled it in", async () => {
    const bare = { ...lc, sansthaNameMr: null, mottoMr: null, recognitionNo: null, recognitionDetailsMr: null };
    const html = await documentHtml(bare);
    expect(html).not.toContain("॥");                // no empty motto brackets
    expect(html).not.toContain("शाळेचा मान्यता क्र.");
    expect(html).toContain(lc.schoolNameMr);        // the school itself still prints
  });

  it("draws the photograph box even when there is no photograph", async () => {
    // The printed form has an empty ruled box; a box that vanished would give
    // two different layouts for the same document, and remove the school's
    // option of pasting one in by hand.
    const html = await documentHtml({ ...lc, photoDataUri: null });
    expect(html).toContain("photo-box");
    expect(html).toContain("छायाचित्र");
    expect(html).not.toContain("<img");
  });

  it("embeds the photograph when there is one", async () => {
    const tiny = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const html = await documentHtml({ ...lc, photoDataUri: tiny });
    expect(html).toContain(tiny);
    // Embedded, never a path Chromium would have to resolve on disk.
    expect(html).not.toMatch(/src="\/api\/images/);
  });

  it("prints the school logo when one is set, and nothing when not", async () => {
    const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    // Match the tag, not the class name — the stylesheet always mentions it.
    const imgTag = /<img[^>]*class="school-logo"/;
    expect(await documentHtml({ ...lc, logoDataUri: logo })).toMatch(imgTag);
    expect(await documentHtml({ ...lc, logoDataUri: null })).not.toMatch(imgTag);
  });

  it("prints no principal or teacher name — the school signs by hand", async () => {
    const html = await documentHtml(lc);
    expect(html).toContain("मुख्याध्यापक");
    expect(html).toContain("वर्गशिक्षक");
    expect(html).not.toContain("सुनीता");   // the principal's name in the fixture
  });

  it("prints the Aadhaar row as a ruled blank, never a number", async () => {
    // The school's printed form carries this field, so the line has to be
    // there. We hold no Aadhaar number to put in it, and the clerk writes it
    // by hand after printing. See tests/unit/no-aadhaar-storage.test.ts.
    const html = await documentHtml(lc);
    expect(html).toContain("आधार कार्ड क्रमांक");

    // The row's value cell must hold the ruled blank and nothing else. An
    // ASCII-digit check would be false comfort here: every figure on this
    // certificate prints in Devanagari, so \d would miss an Aadhaar entirely.
    const row = html.slice(html.indexOf("आधार कार्ड क्रमांक"));
    const valueCell = row.slice(row.indexOf("</td>"), row.indexOf("</tr>"));
    expect(valueCell).toContain("write-in");
    expect(valueCell).not.toMatch(/[0-9०-९]/);
  });

  it("prints the student ID row without it, when the register has no student ID", async () => {
    const html = await documentHtml({ ...lc, studentId: null });
    expect(html).not.toContain("स्टुडंट आय.डी.");
    // The Aadhaar blank still prints — it belongs to the form, not to us.
    expect(html).toContain("आधार कार्ड क्रमांक");
  });

  it("carries the statutory warning about altering the certificate", async () => {
    expect(await documentHtml(lc)).toContain("अनधिकृतरित्या बदल");
  });

  it("prints the previous school, which the register records and the LC needs", async () => {
    const html = await documentHtml(lc);
    expect(html).toContain("मागील शाळेचे नाव");
    expect(html).toContain("जिल्हा परिषद प्राथमिक शाळा, रावडी");
  });

  it("prints the UDISE code and board index", async () => {
    const html = await documentHtml(lc);
    expect(html).toContain("२७२५१०००१०१");
    expect(html).toContain("P-११.१.००१");
  });

  it("never splits an identifier from its label, which A5 used to do", async () => {
    const html = await documentHtml(lc);
    // Each label+number pair is one nowrap span, so a narrow sheet breaks the
    // row between identifiers instead of stranding the number on its own line.
    expect(html).toContain('<span class="id-seg">शाळेचा मान्यता क्र.: S ११.०३.०११</span>');
    expect(html).toContain('<span class="id-seg">ज्यु. कॉलेज इंडेक्स नं.: J ११.०३.०१६</span>');
  });

  it("does not repeat ता./जि. in the identifier row when the address carries it", async () => {
    const html = await documentHtml(lc);
    // Their letterhead states the taluka and district once, inside the
    // address line. Printing it again beneath was ours, not theirs.
    expect(html).toContain("मु. पो. वडगाव, ता. हवेली");
    expect(html).not.toContain('<span class="id-seg">ता. हवेली');
  });

  it("falls back to ता./जि. in the identifier row when there is no address", async () => {
    const html = await documentHtml({ ...lc, schoolAddress: null });
    expect(html).toContain('<span class="id-seg">ता. हवेली, जि. पुणे</span>');
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

describe("bilingual leaving certificate", () => {
  it("adds an English gloss to every label without dropping the Marathi", async () => {
    // renderToStaticMarkup escapes the apostrophe in "Student's" to &#x27;.
    const html = (await documentHtml(lc, { bilingual: true })).replace(/&#x27;/g, "'");
    for (const en of ["Student's full name", "Date of birth (in words)", "Reason for leaving", "Class Teacher"]) {
      expect(html).toContain(en);
    }
    for (const mr of ["विद्यार्थ्याचे संपूर्ण नाव", "जन्मतारीख (अक्षरात)", "मुख्याध्यापक"]) {
      expect(html).toContain(mr);
    }
  });

  it("prints the caste certificate number when present", async () => {
    expect(await documentHtml(lc)).toContain("MH/PUN/2019/0044821");
    expect(await documentHtml({ ...lc, casteCertNo: null })).not.toContain("जात प्रमाणपत्र क्र.");
  });

  it("is Marathi-only by default", async () => {
    expect(await documentHtml(lc)).not.toContain("Student's full name");
  });
});

describe("bonafide", () => {
  it("uses the masculine forms for a boy, with nothing struck through", async () => {
    const html = await documentHtml({ ...bonafide, gender: "male" });
    expect(html).toContain("कुमार");
    expect(html).toContain("त्याची वर्तणूक");
    expect(html).not.toContain("कुमार / कुमारी");   // no unfilled slash
    expect(html).not.toContain("त्याची / तिची");
  });

  it("uses the feminine forms for a girl", async () => {
    const html = await documentHtml({ ...bonafide, gender: "female" });
    expect(html).toContain("कुमारी");
    expect(html).toContain("तिची वर्तणूक");
    expect(html).toContain(" ही आमच्या शाळेत");
  });

  it("prints both forms when gender was never recorded, as a paper form does", async () => {
    // Better an unfilled form than a wrong grammatical gender on a child's
    // certificate.
    const html = await documentHtml({ ...bonafide, gender: null });
    expect(html).toContain("कुमार / कुमारी");
  });

  it("states conduct, which the school's own bonafide carries and ours did not", async () => {
    expect(await documentHtml({ ...bonafide, conduct: "समाधानकारक" })).toContain("समाधानकारक");
    // Defaults rather than leaving the sentence dangling.
    expect(await documentHtml({ ...bonafide, conduct: undefined })).toContain("वर्तणूक");
  });

  it("keeps religion, caste and sub-caste as separate entries", async () => {
    const html = await documentHtml(bonafide);
    expect(html).toContain("धर्म");
    expect(html).toContain("जात");
    expect(html).toContain("पोटजात");
    // Not run together: the register holds them separately and so should the
    // certificate.
    expect(html).not.toContain("हिंदू - मराठा");
  });

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
      expect(html, purpose).toContain("बोनाफाईड सर्टिफिकेट");
    }
  });

  it("renders to PDF", async () => {
    const pdf = await renderDocumentPdf(bonafide);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    await writeFile("/tmp/shaala-bonafide.pdf", pdf);
  });
});

describe("id card", () => {
  it("prints the class in Devanagari, like every other figure on the page", async () => {
    // "इयत्ता 8" among Devanagari numerals reads as an unfinished form; the
    // school's own handwritten certificate says "८ वी".
    const html = await documentHtml({ ...lc, currentClass: "8", currentDivision: "अ" });
    expect(html).toContain("८");
    expect(html).not.toMatch(/इयत्ता[^<]*\b8\b/);
  });

  it("shows name in both scripts, class, GR and blood group", async () => {
    const html = await documentHtml(idCard);
    expect(html).toContain(idCard.studentNameMr);
    expect(html).toContain(idCard.studentNameEn);
    expect(html).toContain("B+");
    expect(html).toContain("१००१");
    expect(html).toContain("१०");   // class 10 in Devanagari
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
