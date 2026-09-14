/**
 * Builds the student-collection sheet a school fills in before onboarding.
 *
 * The headers are not decorative: each one has to be recognised by
 * src/domain/import/parse.ts, or the school's weeks of typing arrive as
 * unmapped columns. tests/unit/collection-template.test.ts asserts exactly
 * that, so this file and the importer cannot drift apart.
 *
 *   npx tsx scripts/make-collection-template.ts
 */
import { writeFileSync } from "node:fs";

/** required: the row is rejected without it. */
export type Column = { header: string; required?: boolean; example: string; note: string };

export const COLUMNS: Column[] = [
  // Identity ---------------------------------------------------------------
  { header: "जनरल रजिस्टर क्र. / GR No.", required: true, example: "3862",
    note: "रजिस्टरमधील क्रमांक. रिकामा ठेवू नका — हाच विद्यार्थ्याची ओळख आहे." },
  { header: "नाव (मराठी) / First name", required: true, example: "संग्राम",
    note: "फक्त पहिले नाव." },
  { header: "वडिलांचे नाव (मराठी) / Father's name", example: "विनायक",
    note: "नावातील मधला भाग." },
  { header: "आडनाव (मराठी) / Surname", required: true, example: "पासलदे", note: "" },
  { header: "First name (English)", required: true, example: "Sangram",
    note: "इंग्रजीत — शासकीय अपलोडसाठी आवश्यक." },
  { header: "Middle name (English)", example: "Vinayak", note: "" },
  { header: "Surname (English)", required: true, example: "Pasalde", note: "" },

  // Birth and identity -----------------------------------------------------
  { header: "जन्मतारीख DD/MM/YYYY / Date of birth", required: true, example: "22/08/2012",
    note: "दिवस/महिना/वर्ष याच क्रमाने. उदा. २२ ऑगस्ट २०१२ = 22/08/2012" },
  { header: "लिंग / Gender", required: true, example: "मुलगा",
    note: "मुलगा किंवा मुलगी" },
  { header: "प्रवर्ग / Category", required: true, example: "OPEN",
    note: "OPEN, SC, ST, VJ-A, NT-B, NT-C, NT-D, OBC, SBC, EWS यापैकी एक" },
  { header: "धर्म / Religion", example: "हिंदू", note: "" },
  { header: "जात / Caste", example: "मराठा", note: "" },
  { header: "पोटजात / Sub-caste", example: "कुणबी", note: "" },
  { header: "जात प्रमाणपत्र क्र. / Caste certificate no.", example: "", note: "असल्यास." },
  { header: "मातृभाषा / Mother tongue", example: "मराठी", note: "" },
  { header: "राष्ट्रीयत्व / Nationality", example: "भारतीय", note: "रिकामे ठेवल्यास भारतीय धरले जाईल." },

  // Parents ----------------------------------------------------------------
  { header: "आईचे नाव / Mother's name", example: "सुनीता विनायक पासलदे", note: "संपूर्ण नाव." },
  { header: "वडिलांचे संपूर्ण नाव / Father's full name", example: "विनायक रामचंद्र पासलदे", note: "" },

  // Birthplace — printed on the leaving certificate ------------------------
  { header: "जन्म गाव / Birth village", example: "सोलापूर", note: "दाखल्यावर छापले जाते." },
  { header: "जन्म तालुका / Birth taluka", example: "सोलापूर", note: "" },
  { header: "जन्म जिल्हा / Birth district", example: "सोलापूर", note: "" },
  { header: "जन्म राज्य / Birth state", example: "महाराष्ट्र", note: "" },

  // Admission and class ----------------------------------------------------
  { header: "प्रवेश दिनांक DD/MM/YYYY / Admission date", required: true, example: "15/06/2023",
    note: "या शाळेत प्रवेश घेतल्याचा दिनांक." },
  { header: "प्रवेश इयत्ता / Class at admission", example: "1", note: "" },
  { header: "मागील शाळेचे नाव / Previous school", example: "जिल्हा परिषद प्राथमिक शाळा, रावडी", note: "" },
  { header: "मागील उत्तीर्ण इयत्ता / Last class passed", example: "7", note: "" },
  { header: "इयत्ता / Class", example: "8", note: "सध्याची इयत्ता — फक्त अंक, उदा. 8" },
  { header: "तुकडी / Division", example: "अ", note: "अ, ब, क, ड" },
  { header: "हजेरी क्रमांक / Roll no.", example: "14", note: "" },

  // Other ------------------------------------------------------------------
  { header: "रक्तगट / Blood group", example: "B+", note: "ओळखपत्रावर छापले जाते." },
  { header: "अपार आयडी / APAAR ID", example: "", note: "१२ अंकी. असल्यास." },
  { header: "स्टुडंट आय.डी. / Student ID (SARAL)", example: "20162725030730100001", note: "सरल प्रणालीतील क्रमांक." },
];

/** Excel needs a UTF-8 BOM or it renders Devanagari as mojibake on Windows. */
const BOM = "﻿";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const row = (cells: string[]) => cells.map(cell).join(",");

export function buildCsv(): string {
  return BOM + [row(COLUMNS.map((c) => c.header)), row(COLUMNS.map((c) => c.example)), ""].join("\n");
}

/** A human-readable companion, because a CSV cannot hold instructions. */
export function buildGuide(): string {
  const req = COLUMNS.filter((c) => c.required);
  const opt = COLUMNS.filter((c) => !c.required);
  const line = (c: Column) => `${c.header}\n    ${c.note || "—"}`;
  return [
    "विद्यार्थी माहिती संकलन — सूचना",
    "STUDENT DATA COLLECTION — INSTRUCTIONS",
    "=".repeat(64),
    "",
    "१. पहिली ओळ (मथळे) बदलू नका. दुसरी ओळ उदाहरण आहे — ती पुसून टाका.",
    "   Do not change the first row. The second row is an example — delete it.",
    "",
    "२. एका विद्यार्थ्यासाठी एक ओळ.  One row per student.",
    "",
    "३. माहिती नसल्यास रकाना रिकामा ठेवा. खाली दिलेले सोडून.",
    "   Leave a cell blank if you do not have it — except the required ones.",
    "",
    "४. तारखा DD/MM/YYYY याच स्वरूपात.  Dates strictly as DD/MM/YYYY.",
    "",
    "५. फाइल .csv किंवा .xlsx म्हणून जतन करा.  Save as .csv or .xlsx.",
    "",
    `आवश्यक रकाने — REQUIRED (${req.length})`,
    "-".repeat(64),
    ...req.map((c) => `  ${line(c)}`),
    "",
    `ऐच्छिक रकाने — OPTIONAL (${opt.length})`,
    "-".repeat(64),
    ...opt.map((c) => `  ${line(c)}`),
    "",
    "प्रवर्ग — CATEGORY must be one of:",
    "  OPEN  SC  ST  VJ-A  NT-B  NT-C  NT-D  OBC  SBC  EWS",
    "",
    "लिंग — GENDER: मुलगा / मुलगी  (or Male / Female)",
    "",
  ].join("\n");
}

if (process.argv[1]?.endsWith("make-collection-template.ts")) {
  writeFileSync("out/student-collection-template.csv", buildCsv(), "utf8");
  writeFileSync("out/student-collection-instructions.txt", BOM + buildGuide(), "utf8");
  console.log(`✓ out/student-collection-template.csv  (${COLUMNS.length} columns)`);
  console.log(`✓ out/student-collection-instructions.txt`);
}
