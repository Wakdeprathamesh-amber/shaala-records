import type { DocumentPayload } from "@/domain/documents/issue";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

import {
  DuplicateMark,
  Field,
  PRINT_CSS,
  SchoolHeader,
  SerialLine,
  Signatures,
  figures,
} from "./shared";

export const LC_CSS = PRINT_CSS;

/**
 * Leaving Certificate — शाळा सोडल्याचा दाखला.
 *
 * The statutory layout for a Maharashtra school. Field order follows the paper
 * form, because a clerk checks the printed certificate against the register by
 * running a finger down both at once; reordering for visual tidiness would
 * make that impossible.
 *
 * The date of birth appears twice, in figures and in words. That redundancy is
 * the point — it is what makes the date hard to alter after issue, and it is
 * why the Marathi number table has to be right.
 */
export function LeavingCertificate({
  p,
  suppressHeader,
}: {
  p: DocumentPayload;
  suppressHeader?: boolean;
}) {
  const birthPlace = [p.birthVillage, p.birthTaluka, p.birthDistrict, p.birthState]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="sheet">
      <DuplicateMark p={p} />
      <SchoolHeader p={p} suppress={suppressHeader} title="शाळा सोडल्याचा दाखला" />
      <SerialLine p={p} />

      <table className="fields">
        <tbody>
          <Field label="१. विद्यार्थ्याचे संपूर्ण नाव" value={<span style={{ fontSize: "10pt" }}>{p.studentNameMr}</span>} />
          <Field label="   (इंग्रजीत)" value={p.studentNameEn} />
          <Field label="२. आईचे नाव" value={p.motherNameMr} />
          <Field label="३. वडिलांचे नाव" value={p.fatherNameMr} />
          <Field label="४. राष्ट्रीयत्व" value={p.nationality} />
          <Field label="५. धर्म" value={p.religion} />
          <Field label="६. जात" value={p.caste} />
          <Field label="७. पोटजात" value={p.subCaste} />
          <Field label="८. प्रवर्ग" value={p.category} />
          <Field label="९. जन्मस्थळ (गाव, तालुका, जिल्हा, राज्य)" value={birthPlace} />
          <Field label="१०. जन्मतारीख (अंकात)" value={figures(p.dob)} />
          <Field
            label="     जन्मतारीख (अक्षरात)"
            value={<span style={{ fontSize: "9pt" }}>{p.dobInWordsMr}</span>}
          />
          <Field label="११. मातृभाषा" value={p.motherTongue} />
          <Field label="१२. शाळेत प्रवेश घेतल्याचा दिनांक" value={figures(p.admissionDate)} />
          <Field label="१३. प्रवेशाच्या वेळची इयत्ता" value={p.admissionClass} />
          <Field label="१४. मागील शाळेत उत्तीर्ण इयत्ता" value={p.lastClassPassed} />
          <Field
            label="१५. शाळा सोडतेवेळची इयत्ता"
            value={
              p.currentClass
                ? `${p.currentClass}${p.currentDivision ? ` (${p.currentDivision})` : ""}`
                : "—"
            }
          />
          <Field label="१६. शाळा सोडल्याचा दिनांक" value={figures(p.dateOfLeaving)} />
          <Field label="१७. शाळा सोडण्याचे कारण" value={p.reasonMr} />
          <Field label="१८. प्रगती" value={p.progress} />
          <Field label="१९. वर्तणूक" value={p.conduct} />
          <Field label="२०. सर्व देणी दिली आहेत काय?" value={p.duesCleared === false ? "नाही" : "होय"} />
          {p.apaarId ? <Field label="२१. अपार आयडी" value={toDevanagariDigits(p.apaarId)} /> : null}
          {p.remarksMr ? <Field label="शेरा" value={p.remarksMr} /> : null}
        </tbody>
      </table>

      <p className="small" style={{ marginTop: "3mm", lineHeight: 1.6 }}>
        वरील माहिती शाळेच्या जनरल रजिस्टरमधील नोंदीवरून दिली आहे. सदर माहिती
        बरोबर असल्याचे प्रमाणित करण्यात येते.
      </p>

      <div className="row small" style={{ marginTop: "3mm" }}>
        <div>
          ठिकाण: <span className="bold">{p.taluka ?? p.district ?? "—"}</span>
        </div>
        <div className="grow" />
        <div>
          दिनांक: <span className="bold">{figures(p.issuedOn)}</span>
        </div>
      </div>

      <Signatures principalName={p.principalNameMr} />

      <p className="tiny center" style={{ marginTop: "5mm", color: "#444" }}>
        हा दाखला संगणकीकृत जनरल रजिस्टरमधून तयार केला आहे.
        अनुक्रमांक {toDevanagariDigits(p.serialNo)} · यू-डायस {toDevanagariDigits(p.udiseCode)}
      </p>
    </div>
  );
}
