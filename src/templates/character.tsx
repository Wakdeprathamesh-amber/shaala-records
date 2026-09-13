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

export const CHARACTER_CSS = PRINT_CSS;

/**
 * Character certificate — चारित्र्य प्रमाणपत्र.
 *
 * Asked for at admission to a new school, for hostel places, and by some
 * employers of school-leavers. It attests to conduct over the period of study
 * and, critically, that no disciplinary action is on record — the sentence a
 * receiving institution actually reads.
 */
export function CharacterCertificate({
  p,
  suppressHeader,
}: {
  p: DocumentPayload;
  suppressHeader?: boolean;
}) {
  const until = p.dateOfLeaving ? figures(p.dateOfLeaving) : "आजपर्यंत";
  const stillHere = !p.dateOfLeaving;
  const cls = classLabel(p.currentClass, p.currentDivision, true);

  return (
    <div className="sheet">
      <DuplicateMark p={p} />
      <SchoolHeader p={p} suppress={suppressHeader} title="चारित्र्य प्रमाणपत्र" />
      <SerialLine p={p} />

      <p style={{ fontSize: "10.5pt", lineHeight: 2.1, marginTop: "6mm" }}>
        प्रमाणित करण्यात येते की, <span className="bold">{p.studentNameMr}</span>
        {p.fatherNameMr ? <> (वडील: <span className="bold">{p.fatherNameMr}</span>)</> : null}
        {" "}(जनरल रजिस्टर क्र. <span className="bold">{toDevanagariDigits(p.grNumber)}</span>)
        {" "}हे/ही या शाळेत दिनांक{" "}
        <span className="bold">{figures(p.admissionDate)}</span> पासून{" "}
        <span className="bold">{until}</span> इयत्ता <span className="bold">{cls}</span> मध्ये{" "}
        {stillHere ? "शिकत आहेत" : "शिकत होते/होती"}.
      </p>

      <p style={{ fontSize: "10.5pt", lineHeight: 2.1 }}>
        या कालावधीत त्यांची वर्तणूक{" "}
        <span className="bold">{p.conduct || "चांगली"}</span> होती. शाळेच्या अभिलेखानुसार
        त्यांच्याविरुद्ध कोणतीही शिस्तभंगाची कारवाई झालेली नाही.
      </p>

      <table className="fields" style={{ marginTop: "4mm" }}>
        <tbody>
          <tr>
            <td className="label">जन्मतारीख</td>
            <td className="value">{figures(p.dob)}</td>
            <td className="label">प्रवर्ग</td>
            <td className="value">{p.category ?? "—"}</td>
          </tr>
          <tr>
            <td className="label">शैक्षणिक वर्ष</td>
            <td className="value">{p.academicYear ? toDevanagariDigits(p.academicYear) : "—"}</td>
            <td className="label">प्रगती</td>
            <td className="value">{p.progress ?? "—"}</td>
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

      <Signatures labels={["वर्गशिक्षक", "", "मुख्याध्यापक"]} />
    </div>
  );
}
