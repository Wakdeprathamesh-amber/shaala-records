import type { BonafidePurpose, DocumentPayload } from "@/domain/documents/issue";
import { toDevanagariDigits } from "@/lib/marathi/numbers";
import { he, his, hisF, honorific } from "@/lib/marathi/gender";

import {
  DuplicateMark,
  PRINT_CSS,
  SchoolHeader,
  SerialLine,
  PhotoBox,
  Signatures,
  classLabel,
  figures,
} from "./shared";

/*
 * A bonafide prints on A5 — half a sheet, which is what the school buys.
 * Mirroring their wording added two paragraphs and a detail table, and the
 * worst case (every field populated, long hyphenated names, the duplicate
 * banner) pushed it to two pages. These numbers hold it to one; the
 * pagination test in lc-pagination.test.ts enforces it.
 */
export const BONAFIDE_CSS =
  PRINT_CSS +
  `
  .sheet { padding: 7mm 10mm; }
  .bona p { font-size: 9.6pt !important; line-height: 1.85 !important; }
  .bona table.fields { margin-top: 2.5mm !important; }
  .bona table.fields td { padding: 0.4mm 1mm; font-size: 8.4pt; }
  .bona .sign-row { margin-top: 6mm; }
`;

/**
 * Each purpose needs its own sentence.
 *
 * A bonafide is only accepted if it states the thing the receiving office
 * needs to see — a bank wants the address confirmed, a passport office wants
 * nationality asserted, a scholarship wants the category. A generic
 * "is a bonafide student" gets handed back across the counter, and the parent
 * makes a second trip.
 */
export const PURPOSE_SENTENCE: Record<BonafidePurpose, string> = {
  scholarship:
    "सदर विद्यार्थी शिष्यवृत्तीसाठी पात्र असून, वरील प्रवर्गाची नोंद शाळेच्या जनरल रजिस्टरनुसार आहे.",
  bank:
    "सदर दाखला बँक खाते उघडण्यासाठी देण्यात येत आहे. विद्यार्थ्याचा पत्ता व जन्मतारीख शाळेच्या अभिलेखानुसार आहे.",
  passport:
    "सदर दाखला पासपोर्टसाठी देण्यात येत आहे. विद्यार्थ्याचे राष्ट्रीयत्व व जन्मस्थळ शाळेच्या अभिलेखानुसार नोंदविले आहे.",
  caste:
    "सदर दाखला जातीचा दाखला काढण्यासाठी देण्यात येत आहे. जात व पोटजात शाळेच्या जनरल रजिस्टरमधील नोंदीनुसार आहे.",
  domicile:
    "सदर दाखला अधिवास (डोमिसाईल) प्रमाणपत्रासाठी देण्यात येत आहे. विद्यार्थी या शाळेत सातत्याने शिक्षण घेत आहे.",
  other: "सदर दाखला विद्यार्थ्याच्या मागणीनुसार देण्यात येत आहे.",
};

export const PURPOSE_LABEL: Record<BonafidePurpose, string> = {
  scholarship: "शिष्यवृत्ती",
  bank: "बँक खाते",
  passport: "पासपोर्ट",
  caste: "जातीचा दाखला",
  domicile: "अधिवास प्रमाणपत्र",
  other: "इतर",
};

export function BonafideCertificate({
  p,
  suppressHeader,
}: {
  p: DocumentPayload;
  suppressHeader?: boolean;
}) {
  const purpose = (p.purpose ?? "other") as BonafidePurpose;
  const birthPlace = [
    p.birthVillage ? `मु.पो. ${p.birthVillage}` : null,
    p.birthTaluka ? `ता. ${p.birthTaluka}` : null,
    p.birthDistrict ? `जि. ${p.birthDistrict}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="sheet bona has-photo">
      <DuplicateMark p={p} />
      <PhotoBox p={p} />
      <SchoolHeader p={p} suppress={suppressHeader} title="बोनाफाईड सर्टिफिकेट" />
      <SerialLine p={p} />

      {/*
        Wording follows the school's own pre-printed bonafide closely, so a
        principal comparing the two side by side sees their document rather
        than ours. The gendered forms their form leaves as "कुमार / कुमारी"
        for the clerk to strike out are filled in here, because the record
        already knows which.
      */}
      <p style={{ marginTop: "4mm" }}>
        दाखला देण्यात येतो की, <span className="bold">{honorific(p.gender)}</span>{" "}
        <span className="bold" style={{ fontSize: "10.5pt" }}>{p.studentNameMr}</span>{" "}
        {he(p.gender)} आमच्या शाळेत सन{" "}
        <span className="bold">{p.academicYear ? toDevanagariDigits(p.academicYear) : "—"}</span>{" "}
        या वर्षात इयत्ता <span className="bold">{classLabel(p.currentClass)}</span>
        {p.currentDivision ? <> तुकडी <span className="bold">{p.currentDivision}</span></> : null}
        {" "}मध्ये शिकत आहे व {hisF(p.gender)} वर्तणूक{" "}
        <span className="bold">{p.conduct || "समाधानकारक"}</span> आहे.
      </p>

      <p style={{ marginTop: "2mm" }}>
        आमच्या दप्तरी असलेल्या रेकॉर्डप्रमाणे {hisF(p.gender)} धर्म{" "}
        <span className="bold">{p.religion || "—"}</span> व जात{" "}
        <span className="bold">{p.caste || "—"}</span>
        {p.subCaste ? <> (पोटजात <span className="bold">{p.subCaste}</span>)</> : null}
        {" "}असून जन्मतारीख <span className="bold">{figures(p.dob)}</span> (अक्षरी{" "}
        <span className="bold">{p.dobInWordsMr}</span>) अशी आहे.
        {birthPlace ? (
          <>
            {" "}{his(p.gender)} जन्मस्थळ <span className="bold">{birthPlace}</span> हे आहे.
          </>
        ) : null}
      </p>

      <table className="fields" style={{ marginTop: "4mm" }}>
        <tbody>
          <tr>
            <td className="label">जनरल रजिस्टर क्र.</td>
            <td className="value">{toDevanagariDigits(p.grNumber)}</td>
            <td className="label">प्रवर्ग</td>
            <td className="value">{p.category ?? "—"}</td>
          </tr>
          <tr>
            <td className="label">वडिलांचे नाव</td>
            <td className="value">{p.fatherNameMr ?? "—"}</td>
            <td className="label">आईचे नाव</td>
            <td className="value">{p.motherNameMr ?? "—"}</td>
          </tr>
          <tr>
            <td className="label">प्रवेश दिनांक</td>
            <td className="value">{figures(p.admissionDate)}</td>
            <td className="label">राष्ट्रीयत्व</td>
            <td className="value">{p.nationality ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: "3mm" }}>
        {purpose === "other" && p.purposeOtherMr
          ? `सदर दाखला ${p.purposeOtherMr} या प्रयोजनासाठी देण्यात येत आहे.`
          : PURPOSE_SENTENCE[purpose]}
      </p>

      <p className="small" style={{ marginTop: "3mm" }}>
        प्रयोजन:{" "}
        <span className="bold">
          {purpose === "other" && p.purposeOtherMr ? p.purposeOtherMr : PURPOSE_LABEL[purpose]}
        </span>
      </p>

      <div className="row small" style={{ marginTop: "4mm" }}>
        <div>
          ठिकाण: <span className="bold">{p.taluka ?? p.district ?? "—"}</span>
        </div>
        <div className="grow" />
        <div>
          दिनांक: <span className="bold">{figures(p.issuedOn)}</span>
        </div>
      </div>

      <Signatures labels={["लिपिक", "", "मुख्याध्यापक"]} />
    </div>
  );
}
