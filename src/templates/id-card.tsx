import type { DocumentPayload } from "@/domain/documents/issue";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

import { figures } from "./shared";

/**
 * Student ID card, 8-up on A4.
 *
 * Standard ID-1 is 85.6 x 54mm. Eight fit on A4 with room for cutting, which
 * is how a school with one printer and no card stock actually produces them:
 * print, guillotine, laminate.
 */
export const ID_CARD_CSS = `
  .grid8 {
    display: grid;
    grid-template-columns: 85.6mm 85.6mm;
    grid-auto-rows: 54mm;
    gap: 4mm 6mm;
    padding: 12mm 14mm;
    justify-content: center;
  }
  .card {
    border: 0.8pt solid #000;
    border-radius: 2mm;
    padding: 2.5mm 3mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .card .school { font-size: 7pt; font-weight: 700; line-height: 1.25; text-align: center; }
  .card .udise { font-size: 5.5pt; text-align: center; color: #333; }
  .card .divider { border-top: 0.5pt solid #666; margin: 1.2mm 0; }
  .card .body { display: flex; gap: 2.5mm; flex: 1; }
  .card .photo {
    width: 18mm; height: 22mm; border: 0.5pt solid #666;
    display: flex; align-items: center; justify-content: center;
    font-size: 5pt; color: #888; flex: none;
  }
  .card .info { flex: 1; font-size: 6.8pt; line-height: 1.5; min-width: 0; }
  .card .name { font-size: 8pt; font-weight: 700; line-height: 1.3; }
  .card .name-en { font-size: 6pt; color: #333; }
  .card .kv { display: flex; gap: 1mm; }
  .card .kv span:first-child { color: #444; }
  .card .foot { font-size: 5.5pt; text-align: center; color: #333; margin-top: 1mm; }
  .blood { font-weight: 700; }
`;

export function IdCard({ p }: { p: DocumentPayload }) {
  return (
    <div className="card">
      <div className="school">{p.schoolNameMr}</div>
      <div className="udise">यू-डायस {toDevanagariDigits(p.udiseCode)}</div>
      <div className="divider" />
      <div className="body">
        <div className="photo">छायाचित्र</div>
        <div className="info">
          <div className="name">{p.studentNameMr}</div>
          <div className="name-en">{p.studentNameEn}</div>
          <div className="kv">
            <span>इयत्ता:</span>
            <span>
              {p.currentClass ?? "—"}
              {p.currentDivision ? ` ${p.currentDivision}` : ""}
            </span>
          </div>
          <div className="kv">
            <span>जीआर:</span>
            <span>{toDevanagariDigits(p.grNumber)}</span>
          </div>
          <div className="kv">
            <span>जन्म:</span>
            <span>{figures(p.dob)}</span>
          </div>
          {p.bloodGroup ? (
            <div className="kv">
              <span>रक्तगट:</span>
              <span className="blood">{p.bloodGroup}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="foot">
        {[p.taluka, p.district].filter(Boolean).join(", ")}
        {p.academicYear ? ` · ${toDevanagariDigits(p.academicYear)}` : ""}
      </div>
    </div>
  );
}

/** A full A4 sheet of up to eight cards. */
export function IdCardSheet({ cards }: { cards: DocumentPayload[] }) {
  return (
    <div className="grid8">
      {cards.map((p) => (
        <IdCard key={`${p.grNumber}-${p.serialNo}`} p={p} />
      ))}
    </div>
  );
}
