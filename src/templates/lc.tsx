import type { DocumentPayload } from "@/domain/documents/issue";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

import {
  DuplicateMark,
  Field,
  PRINT_CSS,
  SchoolHeader,
  SerialLine,
  PhotoBox,
  Signatures,
  classLabel,
  figures,
} from "./shared";

export const LC_CSS =
  PRINT_CSS +
  `
  /* Bilingual labels run longer. Smaller face, tighter cells and a slightly
     wider label column keep a fully populated certificate — caste cert no.,
     APAAR, remarks, duplicate banner — on a single A4 sheet. The pagination
     test holds it there. */
  .bi.sheet { padding: 6mm 10mm; }
  .bi table.fields td { padding: 0.35mm 1mm; font-size: 8.2pt; line-height: 1.35; }
  .bi table.fields td.label { width: 44%; font-size: 7.4pt; }
  .bi table.fields td.label .en { color: #333; font-weight: 400; font-size: 6.6pt; }
  .bi .sign-row { margin-top: 6mm; }
`;

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
 *
 * `bilingual` adds an English gloss to every label. Students moving to an
 * English-medium school or out of state are asked for exactly this, and a
 * second hand-typed English copy is where transcription errors creep in.
 */
export function LeavingCertificate({
  p,
  suppressHeader,
  bilingual = false,
}: {
  p: DocumentPayload;
  suppressHeader?: boolean;
  bilingual?: boolean;
}) {
  const birthPlace = [p.birthVillage, p.birthTaluka, p.birthDistrict, p.birthState]
    .filter(Boolean)
    .join(", ");

  /** Marathi label, with an English gloss on the same line when bilingual.
   *  Inline rather than stacked: stacking every label two-high pushed a fully
   *  populated certificate onto a second page, which the pagination test
   *  caught. */
  const L = (mr: string, en: string) =>
    bilingual ? (
      <>
        {mr} <span className="en">/ {en.replace(/^\s*\d+\.\s*/, "")}</span>
      </>
    ) : (
      mr
    );

  const title = bilingual ? "शाळा सोडल्याचा दाखला / LEAVING CERTIFICATE" : "शाळा सोडल्याचा दाखला";

  return (
    <div className={`sheet has-photo${bilingual ? " bi" : ""}`}>
      <DuplicateMark p={p} />
      <PhotoBox p={p} />
      {/* The warning the printed form carries above the letterhead. It is
          part of the document, not decoration — it is what makes an altered
          certificate an offence rather than a correction. */}
      {!suppressHeader ? (
        <p className="tiny center" style={{ marginBottom: "1mm" }}>
          सूचना — शाळा सोडल्याच्या दाखल्यात अनधिकृतरित्या बदल केल्यास संबंधितांवर
          कायदेशीर कारवाई करण्यात येईल.
        </p>
      ) : null}
      <SchoolHeader p={p} suppress={suppressHeader} title={title} />
      <SerialLine p={p} />

      {/*
        The two identifiers the printed form carries above the numbered fields.
        Student ID comes from the register; the Aadhaar row is deliberately
        left blank for the clerk to write in after printing.

        We do not accept, store or print an Aadhaar number anywhere — see
        AGENTS.md. Holding a register of children's Aadhaar numbers would make
        the school a data fiduciary with breach-notification and erasure duties
        a school office cannot realistically meet, and the exposure would sit
        with them, not with us. The form still needs the line, so we print the
        line and nothing in it.
      */}
      <table className="fields" style={{ marginBottom: "1mm" }}>
        <tbody>
          {p.studentId ? (
            <Field
              label={L("स्टुडंट आय.डी.", "Student ID")}
              value={toDevanagariDigits(p.studentId)}
            />
          ) : null}
          <Field
            label={L("यु आय डी नं. (आधार कार्ड क्रमांक)", "UID no. (Aadhaar card number)")}
            value={<span className="write-in" />}
          />
        </tbody>
      </table>

      <table className="fields">
        <tbody>
          <Field
            label={L("१. विद्यार्थ्याचे संपूर्ण नाव", "1. Student's full name")}
            value={<span style={{ fontSize: "10pt" }}>{p.studentNameMr}</span>}
          />
          <Field label={L("   (इंग्रजीत)", "   (in English)")} value={p.studentNameEn} />
          <Field label={L("२. आईचे नाव", "2. Mother's name")} value={p.motherNameMr} />
          <Field label={L("३. वडिलांचे नाव", "3. Father's name")} value={p.fatherNameMr} />
          <Field label={L("४. राष्ट्रीयत्व", "4. Nationality")} value={p.nationality} />
          <Field label={L("५. धर्म", "5. Religion")} value={p.religion} />
          <Field label={L("६. जात", "6. Caste")} value={p.caste} />
          <Field label={L("७. पोटजात", "7. Sub-caste")} value={p.subCaste} />
          {p.casteCertNo ? (
            <Field label={L("   जात प्रमाणपत्र क्र.", "   Caste certificate no.")} value={p.casteCertNo} />
          ) : null}
          <Field label={L("८. प्रवर्ग", "8. Category")} value={p.category} />
          <Field
            label={L("९. जन्मस्थळ (गाव, तालुका, जिल्हा, राज्य)", "9. Place of birth (village, taluka, district, state)")}
            value={birthPlace}
          />
          <Field label={L("१०. जन्मतारीख (अंकात)", "10. Date of birth (in figures)")} value={figures(p.dob)} />
          <Field
            label={L("     जन्मतारीख (अक्षरात)", "     Date of birth (in words)")}
            value={<span style={{ fontSize: "9pt" }}>{p.dobInWordsMr}</span>}
          />
          <Field label={L("११. मातृभाषा", "11. Mother tongue")} value={p.motherTongue} />
          <Field label={L("१२. शाळेत प्रवेश घेतल्याचा दिनांक", "12. Date of admission")} value={figures(p.admissionDate)} />
          <Field label={L("१३. प्रवेशाच्या वेळची इयत्ता", "13. Class at admission")} value={classLabel(p.admissionClass)} />
          <Field label={L("१४. मागील शाळेचे नाव", "14. Name of previous school")} value={p.previousSchool} />
          <Field label={L("१५. मागील शाळेत उत्तीर्ण इयत्ता", "15. Last class passed there")} value={classLabel(p.lastClassPassed)} />
          <Field
            label={L("१६. शाळा सोडतेवेळची इयत्ता", "16. Class at the time of leaving")}
            value={classLabel(p.currentClass, p.currentDivision, true)}
          />
          <Field label={L("१७. शाळा सोडल्याचा दिनांक", "17. Date of leaving")} value={figures(p.dateOfLeaving)} />
          <Field label={L("१८. शाळा सोडण्याचे कारण", "18. Reason for leaving")} value={p.reasonMr} />
          <Field label={L("१९. प्रगती", "19. Progress")} value={p.progress} />
          <Field label={L("२०. वर्तणूक", "20. Conduct")} value={p.conduct} />
          <Field
            label={L("२१. सर्व देणी दिली आहेत काय?", "21. All dues cleared?")}
            value={p.duesCleared === false ? (bilingual ? "नाही / No" : "नाही") : bilingual ? "होय / Yes" : "होय"}
          />
          {p.apaarId ? (
            <Field label={L("२२. अपार आयडी", "22. APAAR ID")} value={toDevanagariDigits(p.apaarId)} />
          ) : null}
          {p.remarksMr ? <Field label={L("शेरा", "Remarks")} value={p.remarksMr} /> : null}
        </tbody>
      </table>

      <p className="small" style={{ marginTop: "3mm", lineHeight: 1.6 }}>
        वरील माहिती शाळेच्या जनरल रजिस्टरमधील नोंदीवरून दिली आहे. सदर माहिती
        बरोबर असल्याचे प्रमाणित करण्यात येते.
        {bilingual ? (
          <>
            <br />
            <span style={{ color: "#333" }}>
              The above particulars are taken from the school&apos;s General Register and are certified
              to be correct.
            </span>
          </>
        ) : null}
      </p>

      <div className="row small" style={{ marginTop: "3mm" }}>
        <div>
          {bilingual ? "ठिकाण / Place" : "ठिकाण"}:{" "}
          <span className="bold">{p.taluka ?? p.district ?? "—"}</span>
        </div>
        <div className="grow" />
        <div>
          {bilingual ? "दिनांक / Date" : "दिनांक"}: <span className="bold">{figures(p.issuedOn)}</span>
        </div>
      </div>

      <Signatures
        labels={
          bilingual
            ? ["वर्गशिक्षक / Class Teacher", "लिपिक / Clerk", "मुख्याध्यापक / Principal"]
            : ["वर्गशिक्षक", "लिपिक", "मुख्याध्यापक"]
        }
       
      />

      <p className="tiny center" style={{ marginTop: "5mm", color: "#444" }}>
        हा दाखला संगणकीकृत जनरल रजिस्टरमधून तयार केला आहे.
        {bilingual ? " Generated from the computerised General Register." : ""}
        {" "}अनुक्रमांक {toDevanagariDigits(p.serialNo)} · यू-डायस {toDevanagariDigits(p.udiseCode)}
      </p>
    </div>
  );
}
