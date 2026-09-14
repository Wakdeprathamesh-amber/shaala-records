import type { DocumentPayload } from "@/domain/documents/issue";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

/**
 * The class, in Devanagari figures with its division.
 *
 * "इयत्ता 8" on a certificate where every other number is Devanagari looks
 * like a filled-in form someone forgot to finish — the client's own
 * handwritten certificate reads "८ वी".
 */
export function classLabel(
  cls: string | null | undefined,
  division?: string | null,
  bracket = false,
): string {
  if (!cls) return "—";
  const c = toDevanagariDigits(cls);
  if (!division) return c;
  return bracket ? `${c} (${division})` : `${c} ${division}`;
}

/** dd/mm/yyyy in Devanagari figures, as the register writes it. */
export function figures(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return toDevanagariDigits(`${d}/${m}/${y}`);
}

/**
 * Sized to fit a fully-populated leaving certificate on a single A4 sheet.
 *
 * That constraint drives every number below. A certificate whose signature
 * block lands on a second sheet gets rejected by the offices it is presented
 * to, so the layout is tuned to the worst case — every optional field filled,
 * long hyphenated surnames, the duplicate banner — rather than to a
 * comfortable average. tests/integration/lc-pagination.test.ts holds it there.
 */
export const PRINT_CSS = `
  .sheet { padding: 8mm 12mm; position: relative; }
  .rule { border: 1.2pt solid #000; }
  .center { text-align: center; }
  .small { font-size: 8pt; }
  .tiny { font-size: 7pt; }
  .bold { font-weight: 700; }
  .row { display: flex; gap: 4mm; align-items: baseline; }
  .grow { flex: 1; }
  .dotted { border-bottom: 1px dotted #000; min-height: 1.35em; padding: 0 1mm; }
  table.fields { width: 100%; border-collapse: collapse; }
  table.fields td { padding: 0.5mm 1mm; vertical-align: baseline; font-size: 8.8pt; line-height: 1.45; }
  table.fields td.label { width: 38%; }
  table.fields td.value { border-bottom: 1px dotted #555; font-weight: 600; }
  table.fields tr td { page-break-inside: avoid; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 8mm; }
  .sign { text-align: center; font-size: 8pt; width: 30%; }
  .sign .line { border-top: 1px solid #000; margin-bottom: 1mm; padding-top: 1mm; }
  .watermark {
    position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center; pointer-events: none;
  }
  .watermark span {
    font-size: 48pt; color: rgba(180, 0, 0, 0.13);
    transform: rotate(-28deg); font-weight: 700; letter-spacing: 0.1em;
  }
  .photo-box {
    width: 24mm; height: 30mm;
    border: 0.6pt solid #444;
    position: absolute; top: 8mm; right: 12mm;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; background: #fff;
  }
  .photo-box img { width: 100%; height: 100%; object-fit: cover; }
  .photo-box .empty { font-size: 6pt; color: #999; text-align: center; line-height: 1.3; }
  .has-photo header { padding-right: 28mm; }
  .school-logo { height: 16mm; width: auto; margin-bottom: 1mm; }
  /* A field the school fills in by hand after printing. Ruled rather than
     empty, so it reads as "write here" and not as a rendering failure. */
  .write-in {
    display: inline-block;
    min-width: 62mm;
    border-bottom: 0.5pt dotted #555;
    height: 3.6mm;
    vertical-align: bottom;
  }
  .dup-banner {
    border: 1.2pt solid #b00; color: #b00; font-weight: 700;
    padding: 0.6mm 2mm; display: inline-block; font-size: 8.5pt; margin-bottom: 1mm;
  }
`;

/**
 * The school header.
 *
 * `suppress` exists for schools that print onto pre-printed stationery which
 * already carries the letterhead — printing ours on top would overlap it.
 */
export function SchoolHeader({
  p,
  suppress,
  title,
}: {
  p: DocumentPayload;
  suppress?: boolean;
  title: string;
}) {
  if (suppress) {
    return (
      <div className="center" style={{ marginBottom: "6mm" }}>
        {/* Space where the pre-printed letterhead sits. */}
        <div style={{ height: "28mm" }} />
        <div className="bold" style={{ fontSize: "11.5pt", textDecoration: "underline" }}>
          {title}
        </div>
      </div>
    );
  }

  return (
    <header className="center" style={{ marginBottom: "2.5mm" }}>
      {/* Motto, then trust, then the school. This is the order every
          Maharashtra letterhead uses, and a principal checks it first. */}
      {p.logoDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="school-logo" src={p.logoDataUri} alt="" />
      ) : null}
      {p.mottoMr ? <div className="tiny">॥ {p.mottoMr} ॥</div> : null}
      {p.sansthaNameMr ? <div className="small">{p.sansthaNameMr}</div> : null}
      <div className="bold" style={{ fontSize: "12.5pt", lineHeight: 1.25 }}>
        {p.schoolNameMr}
      </div>
      <div className="small">{p.schoolNameEn}</div>
      {p.schoolAddress ? <div className="small">{p.schoolAddress}</div> : null}
      <div className="tiny" style={{ marginTop: "1mm" }}>
        {p.taluka ? `ता. ${p.taluka}` : ""}
        {p.district ? `, जि. ${p.district}` : ""}
        {"  |  "}
        यू-डायस क्र.: {toDevanagariDigits(p.udiseCode)}
        {p.recognitionNo ? `  |  शाळेचा मान्यता क्र.: ${p.recognitionNo}` : ""}
        {p.jrCollegeIndexNo ? `  |  ज्यु. कॉलेज इंडेक्स नं.: ${p.jrCollegeIndexNo}` : ""}
        {p.boardIndex ? `  |  बोर्ड निर्देशांक: ${p.boardIndex}` : ""}
      </div>
      {p.recognitionDetailsMr ? (
        <div className="tiny" style={{ color: "#333" }}>{p.recognitionDetailsMr}</div>
      ) : null}
      <div
        className="bold"
        style={{
          fontSize: "11.5pt",
          marginTop: "2mm",
          textDecoration: "underline",
          textUnderlineOffset: "3px",
        }}
      >
        {title}
      </div>
    </header>
  );
}

/**
 * The photograph box, top right, where the school pastes one by hand today.
 *
 * Always drawn, even with no photograph — an empty ruled box is what the
 * printed form has, and it leaves the school the option of pasting one. A box
 * that vanished when the record had no picture would give two different
 * certificate layouts for the same document.
 */
export function PhotoBox({ p }: { p: DocumentPayload }) {
  return (
    <div className="photo-box">
      {p.photoDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photoDataUri} alt="" />
      ) : (
        <span className="empty">छायाचित्र</span>
      )}
    </div>
  );
}

export function SerialLine({ p }: { p: DocumentPayload }) {
  return (
    <div className="row small" style={{ marginBottom: "2mm" }}>
      <div>
        अनुक्रमांक: <span className="bold">{toDevanagariDigits(p.serialNo)}</span>
      </div>
      <div className="grow" />
      <div>
        जनरल रजिस्टर क्र.: <span className="bold">{toDevanagariDigits(p.grNumber)}</span>
      </div>
      <div className="grow" />
      <div>
        दिनांक: <span className="bold">{figures(p.issuedOn)}</span>
      </div>
    </div>
  );
}

export function DuplicateMark({ p }: { p: DocumentPayload }) {
  if (!p.isDuplicate) return null;
  return (
    <>
      <div className="dup-banner">द्वितीय प्रत — DUPLICATE</div>
      <div className="watermark" aria-hidden>
        <span>द्वितीय प्रत</span>
      </div>
    </>
  );
}

/**
 * Signature blocks: the role, a rule to sign above, and nothing else.
 *
 * We deliberately do not print the principal's or teacher's name. The school
 * signs and stamps by hand, and a printed name under a blank rule looks like
 * an unsigned document — worse, it goes stale the moment a principal changes
 * and every certificate in the file then names the wrong person.
 */
export function Signatures({
  labels = ["वर्गशिक्षक", "लिपिक", "मुख्याध्यापक"],
}: {
  labels?: [string, string, string] | string[];
}) {
  return (
    <div className="sign-row">
      {labels.map((l, i) => (
        <div className="sign" key={`${l}-${i}`}>
          <div className="line" />
          <div>{l}</div>
        </div>
      ))}
    </div>
  );
}

export function Field({
  label,
  value,
  colSpan,
}: {
  /** A string, or an element — the bilingual LC stacks an English gloss. */
  label: React.ReactNode;
  value: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <tr>
      <td className="label">{label}</td>
      <td className="value" colSpan={colSpan}>
        {value || "—"}
      </td>
    </tr>
  );
}
