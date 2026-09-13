import type { DemographicTable } from "@/domain/reports/pivot";
import { CATEGORY_LABEL } from "@/domain/students/schema";
import { toDevanagariDigits } from "@/lib/marathi/numbers";

import { figures } from "./shared";

/*
 * Sized to hold all ten categories plus an "unrecorded" row and the totals on
 * one landscape A4 sheet. The first cut ran 54px over: the two-line category
 * cells inherited the document's 1.65 leading, meant for running Devanagari
 * text, not tabular figures. tests/integration/demographic-pagination.test.ts
 * measures the rendered height and holds it here.
 */
export const DEMOGRAPHIC_CSS = `
  .sheet { padding: 6mm 10mm; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .small { font-size: 8pt; }
  .tiny { font-size: 7pt; }
  table.reg { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 3mm; line-height: 1.25; }
  table.reg th, table.reg td { border: 0.5pt solid #000; padding: 0.6mm 1.2mm; text-align: center; }
  table.reg th { background: #eee; font-weight: 700; }
  table.reg td.cat { text-align: left; white-space: nowrap; font-weight: 600; }
  table.reg td.cat .en { color: #333; font-weight: 400; font-size: 7pt; }
  table.reg tr.total td { font-weight: 700; background: #f4f4f4; }
  table.reg td.sum { font-weight: 700; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 6mm; }
  .sign { text-align: center; font-size: 8pt; width: 30%; }
  .sign .line { border-top: 1px solid #000; margin-bottom: 1mm; padding-top: 1mm; }
`;

export type DemographicSchool = {
  nameMr: string;
  nameEn: string;
  udiseCode: string;
  taluka: string | null;
  district: string | null;
  principalNameMr: string | null;
};

/**
 * प्रवर्गनिहाय नोंदवही — the demographic register in MSBSHSE inspection format.
 *
 * Landscape A4: twelve classes × three columns plus totals do not fit portrait
 * at any legible size. Categories are the state's ten, in the state's order.
 */
export function DemographicRegister({
  school,
  yearLabel,
  table,
  generatedOn,
}: {
  school: DemographicSchool;
  yearLabel: string | null;
  table: DemographicTable;
  generatedOn: string;
}) {
  const d = (n: number) => (n === 0 ? "–" : toDevanagariDigits(n));
  const rows = table.unknown ? [...table.rows, table.unknown] : table.rows;

  return (
    <div className="sheet">
      <header className="center">
        <div className="bold" style={{ fontSize: "12pt" }}>{school.nameMr}</div>
        <div className="small">{school.nameEn}</div>
        <div className="tiny">
          {school.taluka ? `ता. ${school.taluka}` : ""}
          {school.district ? `, जि. ${school.district}` : ""} | यू-डायस {toDevanagariDigits(school.udiseCode)}
        </div>
        <div className="bold" style={{ fontSize: "11pt", marginTop: "2mm", textDecoration: "underline" }}>
          प्रवर्गनिहाय व लिंगनिहाय विद्यार्थी संख्या — शैक्षणिक वर्ष {yearLabel ? toDevanagariDigits(yearLabel) : "—"}
        </div>
      </header>

      <table className="reg">
        <thead>
          <tr>
            <th rowSpan={2}>प्रवर्ग</th>
            {table.classes.map((c) => (
              <th key={c} colSpan={3}>इयत्ता {toDevanagariDigits(c)}</th>
            ))}
            <th colSpan={3}>एकूण</th>
          </tr>
          <tr>
            {[...table.classes, "__total"].map((c) => (
              <>
                <th key={`${c}-m`}>मुले</th>
                <th key={`${c}-f`}>मुली</th>
                <th key={`${c}-t`}>एकूण</th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category}>
              <td className="cat">
                {r.category === "—" ? (
                  <>अनोंदित<br /><span className="en">not recorded</span></>
                ) : (
                  <>
                    {r.category}
                    <br />
                    <span className="en">
                      {(CATEGORY_LABEL[r.category as keyof typeof CATEGORY_LABEL] ?? "").split(" — ")[1] ?? ""}
                    </span>
                  </>
                )}
              </td>
              {table.classes.map((c) => (
                <>
                  <td key={`${r.category}-${c}-m`}>{d(r.byClass[c].m)}</td>
                  <td key={`${r.category}-${c}-f`}>{d(r.byClass[c].f)}</td>
                  <td key={`${r.category}-${c}-t`} className="sum">{d(r.byClass[c].t)}</td>
                </>
              ))}
              <td>{d(r.total.m)}</td>
              <td>{d(r.total.f)}</td>
              <td className="sum">{d(r.total.t)}</td>
            </tr>
          ))}
          <tr className="total">
            <td className="cat">एकूण</td>
            {table.classes.map((c) => {
              const col = rows.reduce(
                (acc, r) => ({ m: acc.m + r.byClass[c].m, f: acc.f + r.byClass[c].f, t: acc.t + r.byClass[c].t }),
                { m: 0, f: 0, t: 0 },
              );
              return (
                <>
                  <td key={`tot-${c}-m`}>{d(col.m)}</td>
                  <td key={`tot-${c}-f`}>{d(col.f)}</td>
                  <td key={`tot-${c}-t`}>{d(col.t)}</td>
                </>
              );
            })}
            <td>{d(table.grand.m)}</td>
            <td>{d(table.grand.f)}</td>
            <td>{d(table.grand.t)}</td>
          </tr>
        </tbody>
      </table>

      <p className="tiny" style={{ marginTop: "3mm", color: "#444" }}>
        फक्त सध्या शिकत असलेले विद्यार्थी. दिनांक {figures(generatedOn)} रोजी संगणकीकृत जनरल
        रजिस्टरमधून तयार. — Currently studying students only; generated from the computerised
        General Register on {generatedOn}.
      </p>

      <div className="sign-row">
        <div className="sign"><div className="line" />लिपिक</div>
        <div className="sign" />
        <div className="sign">
          <div className="line" />मुख्याध्यापक
          {school.principalNameMr ? <div className="tiny">{school.principalNameMr}</div> : null}
        </div>
      </div>
    </div>
  );
}
