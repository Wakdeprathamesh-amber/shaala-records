/**
 * Not a test — a generator, run through vitest because that is where the
 * `server-only` alias lives. Writes sample certificates on the first client's
 * letterhead into out/, for showing the principal.
 *
 *   npm run samples
 */
import { afterAll, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { printDocument, renderPdf, closePdfRenderer } from "@/lib/pdf";
import { LeavingCertificate, LC_CSS } from "@/templates/lc";
import { BonafideCertificate, BONAFIDE_CSS } from "@/templates/bonafide";
import { IdCardSheet, ID_CARD_CSS } from "@/templates/id-card";
import { CharacterCertificate, CHARACTER_CSS } from "@/templates/character";
import { NocCertificate, NOC_CSS } from "@/templates/noc";

afterAll(async () => {
  await closePdfRenderer();
});

const school = {
  sansthaNameMr: "सरस्वती प्रतिष्ठान दधीचींना प्रणाम संस्थेचे",
  mottoMr: "तमसो मा ज्योतिर्गमय",
  schoolNameMr: "क्रांतिवीर वासुदेव बळवंत फडके स्मृती विद्यालय व ज्यु. कॉलेज",
  schoolNameEn: "Krantiveer Vasudev Balwant Phadke Smruti Vidyalaya & Jr. College",
  udiseCode: "27250314502",
  boardIndex: null,
  recognitionNo: "S 11.03.011",
  recognitionDetailsMr:
    "शाळा मान्यता क्रमांक १९ सप्टेंबर १९८३ SSN - 1083/6797 N mash · जा.क्र.शि.उसं/उमाशि/पुवि/स्वअंशगा/मान्यता/१४-१५/९०२७/३० शिक्षण उपसंचालक पुणे विभाग पुणे दि. २९/४/२०१४",
  schoolAddress: "'कमिन्स भवन', मु. रावडी, पो. चिखलगाव, ता. भोर, जि. पुणे – ४१२२०६",
  taluka: "भोर",
  district: "पुणे",
  principalNameMr: "मुख्याध्यापक",
};

/** Modelled on their bonafide no. 446 so the two can be compared directly. */
const base = {
  version: 1 as const,
  issuedOn: "2026-09-09",
  isDuplicate: false,
  ...school,
  grNumber: "3862",
  grNumberMr: "तीन हजार आठशे बासष्ट",
  apaarId: null,
  studentNameMr: "संग्राम विनायक पासलदे",
  studentNameEn: "Sangram Vinayak Pasalde",
  gender: "male" as const,
  motherNameMr: "सौ. सुनीता विनायक पासलदे",
  fatherNameMr: "विनायक पासलदे",
  dob: "2012-08-22",
  dobInWordsMr: "बावीस ऑगस्ट दोन हजार बारा",
  birthVillage: "सोलापूर",
  birthTaluka: "सोलापूर",
  birthDistrict: "सोलापूर",
  birthState: "महाराष्ट्र",
  caste: "मराठा",
  subCaste: "कुणबी",
  casteCertNo: null,
  category: "OPEN",
  religion: "हिंदू",
  nationality: "Indian",
  motherTongue: "मराठी",
  bloodGroup: "B+",
  admissionDate: "2020-06-15",
  admissionClass: "1",
  previousSchool: "जिल्हा परिषद प्राथमिक शाळा, सोलापूर",
  lastClassPassed: "7",
  currentClass: "8",
  currentDivision: "अ",
  academicYear: "2026-27",
};

const lc = {
  ...base, docType: "lc" as const, serialNo: 1,
  dateOfLeaving: "2027-04-30", lastAttended: "2027-04-28",
  reasonMr: "पुढील शिक्षणासाठी", progress: "समाधानकारक", conduct: "चांगले",
  duesCleared: true, remarksMr: null,
};

it("writes sample certificates to out/", async () => {
  mkdirSync("out", { recursive: true });

  const write = async (name: string, markup: string, css: string, format: "A4" | "A5", landscape = false) => {
    const pdf = await renderPdf(await printDocument(markup, css), { format, landscape });
    writeFileSync(`out/${name}.pdf`, pdf);
    const pages = (pdf.toString("latin1").match(/MediaBox/g) ?? []).length;
    console.log(`  ✓ out/${name}.pdf  ${format}${landscape ? " landscape" : ""}, ${pages} page`);
  };

  await write("1-Bonafide",
    renderToStaticMarkup(createElement(BonafideCertificate as never, { p: { ...base, docType: "bonafide", serialNo: 446, conduct: "समाधानकारक", purpose: "other" } })),
    BONAFIDE_CSS, "A5");

  await write("2-LeavingCertificate",
    renderToStaticMarkup(createElement(LeavingCertificate as never, { p: lc })), LC_CSS, "A4");

  await write("3-LeavingCertificate-bilingual",
    renderToStaticMarkup(createElement(LeavingCertificate as never, { p: lc, bilingual: true })), LC_CSS, "A4");

  await write("4-CharacterCertificate",
    renderToStaticMarkup(createElement(CharacterCertificate as never, { p: { ...base, docType: "character", serialNo: 1, conduct: "चांगली", progress: "समाधानकारक" } })),
    CHARACTER_CSS, "A5");

  await write("5-NOC",
    renderToStaticMarkup(createElement(NocCertificate as never, { p: { ...base, docType: "noc", serialNo: 1, nocPurposeMr: "इतर शाळेत प्रवेश घेण्यास" } })),
    NOC_CSS, "A5");

  await write("6-IdCards",
    renderToStaticMarkup(createElement(IdCardSheet as never, {
      cards: ["संग्राम विनायक पासलदे", "स्नेहा विठ्ठल जाधव", "रोहित बाळासाहेब देशमुख", "प्रिया रमेश कुलकर्णी",
              "सागर दत्तात्रय शिंदे", "ऐश्वर्या प्रकाश गायकवाड", "निखिल अशोक मोरे", "पूजा सुरेश पवार"]
        .map((studentNameMr, i) => ({ ...base, docType: "id_card", serialNo: i + 1, grNumber: String(3862 + i), studentNameMr })),
    })),
    ID_CARD_CSS, "A4");

  // The two client-facing pages, forced light — a PDF gets printed, and a
  // dark page wastes toner.
  const SCRATCH = "/private/tmp/claude-502/-Users-amberuser-Desktop-My-Projects-School-ERP/2af7019c-8ed1-4aa4-abac-fa429420452c/scratchpad";
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });

  for (const [src, name] of [
    ["onboarding.html", "0-Shaala-Records-Overview"],
    ["fields.html", "7-Student-Record-Fields"],
  ] as const) {
    const tab = await browser.newPage();
    await tab.setContent(
      `<!doctype html><html lang="mr" data-theme="light"><head><meta charset="utf-8"></head><body>${readFileSync(`${SCRATCH}/${src}`, "utf8")}</body></html>`,
      { waitUntil: "networkidle" },
    );
    await tab.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
    writeFileSync(`out/${name}.pdf`, await tab.pdf({
      format: "A4", printBackground: true,
      margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#888;padding:0 14mm;display:flex;justify-content:space-between;">' +
        '<span>शाळा रेकॉर्ड्स · Shaala Records</span><span class="pageNumber"></span></div>',
    }));
    await tab.close();
    console.log(`  ✓ out/${name}.pdf`);
  }
  await browser.close();
}, 180_000);
