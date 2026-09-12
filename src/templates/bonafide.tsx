import type { BonafidePurpose, DocumentPayload } from "@/domain/documents/issue";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

import {
  DuplicateMark,
  PRINT_CSS,
  SchoolHeader,
  SerialLine,
  Signatures,
  figures,
} from "./shared";

export const BONAFIDE_CSS = PRINT_CSS;

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
  const birthPlace = [p.birthVillage, p.birthTaluka, p.birthDistrict]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="sheet">
      <DuplicateMark p={p} />
      <SchoolHeader p={p} suppress={suppressHeader} title="बोनाफाईड प्रमाणपत्र" />
      <SerialLine p={p} />

      <p style={{ fontSize: "10.5pt", lineHeight: 2.1, marginTop: "6mm" }}>
        प्रमाणित करण्यात येते की, <span className="bold">{p.studentNameMr}</span>
        {p.fatherNameMr ? <> (वडील: <span className="bold">{p.fatherNameMr}</span>)</> : null}
        {p.motherNameMr ? <>, (आई: <span className="bold">{p.motherNameMr}</span>)</> : null}
        {" "}हे/ही या शाळेचे नियमित विद्यार्थी असून, शैक्षणिक वर्ष{" "}
        <span className="bold">{p.academicYear ? toDevanagariDigits(p.academicYear) : "—"}</span>
        {" "}मध्ये इयत्ता{" "}
        <span className="bold">
          {p.currentClass ?? "—"}
          {p.currentDivision ? ` (${p.currentDivision})` : ""}
        </span>
        {" "}मध्ये शिकत आहेत.
      </p>

      <table className="fields" style={{ marginTop: "4mm" }}>
        <tbody>
          <tr>
            <td className="label">जनरल रजिस्टर क्र.</td>
            <td className="value">{toDevanagariDigits(p.grNumber)}</td>
            <td className="label">जन्मतारीख</td>
            <td className="value">{figures(p.dob)}</td>
          </tr>
          <tr>
            <td className="label">जात / प्रवर्ग</td>
            <td className="value">{[p.caste, p.category].filter(Boolean).join(" / ") || "—"}</td>
            <td className="label">राष्ट्रीयत्व</td>
            <td className="value">{p.nationality ?? "—"}</td>
          </tr>
          <tr>
            <td className="label">जन्मस्थळ</td>
            <td className="value">{birthPlace || "—"}</td>
            <td className="label">प्रवेश दिनांक</td>
            <td className="value">{figures(p.admissionDate)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: "10pt", lineHeight: 2, marginTop: "5mm" }}>
        {PURPOSE_SENTENCE[purpose]}
      </p>

      <p className="small" style={{ marginTop: "3mm" }}>
        प्रयोजन: <span className="bold">{PURPOSE_LABEL[purpose]}</span>
      </p>

      <div className="row small" style={{ marginTop: "6mm" }}>
        <div>
          ठिकाण: <span className="bold">{p.taluka ?? p.district ?? "—"}</span>
        </div>
        <div className="grow" />
        <div>
          दिनांक: <span className="bold">{figures(p.issuedOn)}</span>
        </div>
      </div>

      <Signatures labels={["लिपिक", "", "मुख्याध्यापक"]} principalName={p.principalNameMr} />
    </div>
  );
}
