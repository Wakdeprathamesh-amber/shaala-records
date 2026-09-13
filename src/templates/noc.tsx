import type { DocumentPayload } from "@/domain/documents/issue";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

import {
  DuplicateMark,
  PRINT_CSS,
  SchoolHeader,
  SerialLine,
  Signatures,
  classLabel,
  figures,
} from "./shared";

export const NOC_CSS = PRINT_CSS;

/** The purpose a clerk most often types; shown when none is given. */
export const DEFAULT_NOC_PURPOSE = "इतर शाळेत प्रवेश घेण्यास";

/**
 * No Objection Certificate — ना-हरकत प्रमाणपत्र.
 *
 * Issued when a student needs the school's formal consent for something
 * outside it: admission elsewhere mid-year, a sports or exam entry under
 * another body, a hostel. The purpose is the whole document, so it is a free
 * field in the school's own words rather than a fixed list.
 */
export function NocCertificate({
  p,
  suppressHeader,
}: {
  p: DocumentPayload;
  suppressHeader?: boolean;
}) {
  const cls = classLabel(p.currentClass, p.currentDivision, true);

  return (
    <div className="sheet">
      <DuplicateMark p={p} />
      <SchoolHeader p={p} suppress={suppressHeader} title="ना-हरकत प्रमाणपत्र" />
      <SerialLine p={p} />

      <p style={{ fontSize: "10.5pt", lineHeight: 2.1, marginTop: "6mm" }}>
        प्रमाणित करण्यात येते की, <span className="bold">{p.studentNameMr}</span>
        {p.fatherNameMr ? <> (वडील: <span className="bold">{p.fatherNameMr}</span>)</> : null}
        {" "}(जनरल रजिस्टर क्र. <span className="bold">{toDevanagariDigits(p.grNumber)}</span>)
        {" "}हे/ही या शाळेचे नियमित विद्यार्थी असून, शैक्षणिक वर्ष{" "}
        <span className="bold">{p.academicYear ? toDevanagariDigits(p.academicYear) : "—"}</span>
        {" "}मध्ये इयत्ता <span className="bold">{cls}</span> मध्ये शिकत आहेत.
      </p>

      <p style={{ fontSize: "10.5pt", lineHeight: 2.1 }}>
        सदर विद्यार्थ्यास{" "}
        <span className="bold">{p.nocPurposeMr || DEFAULT_NOC_PURPOSE}</span>{" "}
        या शाळेची कोणतीही हरकत नाही. शाळेची सर्व देणी दिली आहेत.
      </p>

      <table className="fields" style={{ marginTop: "4mm" }}>
        <tbody>
          <tr>
            <td className="label">जन्मतारीख</td>
            <td className="value">{figures(p.dob)}</td>
            <td className="label">प्रवेश दिनांक</td>
            <td className="value">{figures(p.admissionDate)}</td>
          </tr>
          <tr>
            <td className="label">प्रवर्ग</td>
            <td className="value">{p.category ?? "—"}</td>
            <td className="label">अपार आयडी</td>
            <td className="value">{p.apaarId ? toDevanagariDigits(p.apaarId) : "—"}</td>
          </tr>
        </tbody>
      </table>

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
